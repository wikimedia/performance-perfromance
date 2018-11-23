( function () {
	function getParam( name ) {
		if (
			( name = new RegExp( '[?&]' + encodeURIComponent( name ) + '=([^&]*)' ).exec(
				location.search
			) )
		) {
			return decodeURIComponent( name[ 1 ] );
		}
	}

	function fetchThat( url ) {
		return fetch( url ).then( function ( response ) {
			if ( !response.ok ) {
				throw new Error(
					'Failed to fetch from ' + url + '. Error: ' + response.statusText
				);
			}
			return response.text();
		} );
	}

	function xmlToJson( xml ) {
		var domParser = new DOMParser();
		return domParser.parseFromString( xml, 'text/xml' );
	}

	function getFileType( name ) {
		if ( name.endsWith( '.mp4' ) ) {
			return 'video';
		} else if ( name.endsWith( '.jpg' ) ) {
			return 'img';
		} else if ( name.endsWith( '.har.gz' ) ) {
			return 'har';
		} else if ( name.startsWith( 'trace-' ) ) {
			return 'chrome-trace';
		} else {
			return 'file';
		}
	}

	function awsToFilesAndFolders( awsObject ) {
		var filesAndFolders = [],
			listBucketResult = awsObject.childNodes[ 0 ],
			dir = '',
			i,
			node,
			prefix,
			key,
			name;

		for ( i = 0; i < listBucketResult.childNodes.length; i++ ) {
			node = listBucketResult.childNodes[ i ];
			if ( node.nodeName === 'Prefix' ) {
				dir = node.textContent;
			}
			if ( node.nodeName === 'CommonPrefixes' ) {
				// This is a directory
				prefix = node.childNodes[ 0 ];
				filesAndFolders.push( {
					name: prefix.textContent.replace( dir, '' ),
					dir: dir,
					type: 'dir'
				} );
			} else if ( node.nodeName === 'Contents' ) {
				// This is a file!
				key = node.childNodes[ 0 ];
				name = key.textContent.replace( dir, '' );
				filesAndFolders.push( {
					name: name,
					dir: dir,
					type: getFileType( name )
				} );
			}
		}
		return filesAndFolders;
	}

	function getDashboardUrl( items ) {
		var wiki = items[ 0 ],
			device = items.length > 1 ? items[ 1 ] : undefined,
			browser = items.length > 2 ? items[ 2 ] : undefined,
			latency = items.length > 3 ? items[ 3 ] : undefined,
			dashboardUrl =
				'https://grafana.wikimedia.org/dashboard/db/webpagereplay?var-wiki=' +
				wiki +
				( device ? '&var-device=' + device : '' ) +
				( browser ? '&var-browser=' + browser : '' ) +
				( latency ? '&var-latency=' + latency : '' );
		return dashboardUrl;
	}

	function getNavigation( prefix ) {
		var navigation = '<a href="?">start</a>',
			navTotal = '',
			navItems,
			i,
			nav,
			dashboardUrl;
		if ( prefix ) {
			navItems = prefix.split( '/' );

			for ( i = 0; i < navItems.length; i++ ) {
				nav = navItems[ i ];
				navigation +=
					'/ <a href="?prefix=' + navTotal + nav + '/">' + nav + '</a>';
				navTotal += nav + '/';
			}
			dashboardUrl = getDashboardUrl( navItems );
			navigation += '<p><a href="' + dashboardUrl + '">Go to dashboard</a></p>';
		}
		return navigation;
	}

	function getTable( filesAndFolders, prefix, base ) {
		var oneStepBack,
			removedSlash,
			blockList = [
				'index.html',
				'robots.txt',
				'style.css',
				'index.js',
				'timeline'
			],
			i,
			rows,
			file,
			url;

		if ( prefix ) {
			removedSlash = prefix.substr( 0, prefix.length - 1 );
			oneStepBack = removedSlash.substr( 0, removedSlash.lastIndexOf( '/' ) + 1 );
		}

		rows = prefix ?
			'<tr><td><a href="?prefix=' + oneStepBack + '">...</a></td></tr>' :
			'';

		for ( i = 0; i < filesAndFolders.length; i++ ) {
			file = filesAndFolders[ i ];
			if ( blockList.indexOf( file.name ) > -1 ) {
				continue;
			}
			rows += '<tr><td>';
			url = base + '/' + file.dir + file.name;

			if ( file.type === 'dir' ) {
				rows +=
					'<a href="?prefix=' +
					file.dir +
					file.name +
					'">' +
					file.name +
					'</a>';
			} else if ( file.type === 'har' ) {
				rows +=
					'<a href="https://compare.sitespeed.io?har1=' +
					url.replace( 'http://', 'https://' ) +
					'&compare=1">' +
					file.name +
					'</a> ';
				rows += '<a href="' + url + '">[download]</a>';
			} else if ( file.type === 'chrome-trace' ) {
				rows +=
					'<a href = "/timeline/?loadTimelineFromURL=' +
					url +
					'">' +
					file.name +
					'</a> ';
				rows += '<a href="' + url + '">[download]</a>';
			} else if ( file.type === 'img' ) {
				rows +=
					file.name +
					'<a href="' +
					url +
					'"><img src = "' +
					url +
					'"width = 400 ></a>';
			} else if ( file.type === 'video' ) {
				rows +=
					file.name +
					'<video width = "400" controls> <source src = "' +
					url +
					'" type="video/mp4"></video>';
			} else {
				rows += '<a href="' + url + '">' + file.name + '</a>';
			}
			rows += '</td></tr>';
		}
		return rows;
	}

	function run() {
		var prefix = getParam( 'prefix' ),
			base = 'http://webpagereplay-wikimedia.s3.us-east-1.amazonaws.com',
			url = prefix ?
				base + '/?delimiter=/&prefix=' + prefix :
				base + '?delimiter=/';

		fetchThat( url ).then( function ( result ) {
			var js = xmlToJson( result ),
				filesAndFolders = awsToFilesAndFolders( js );

			// If we have only dates we want to reverse the order
			// and display latest first
			if ( prefix && prefix.split( '/' ).length === 6 ) {
				filesAndFolders.reverse();
			}

			document.getElementById( 'navigation' ).innerHTML = getNavigation( prefix );
			document.getElementById( 'content' ).innerHTML =
				'<table>' + getTable( filesAndFolders, prefix, base ) + '</table>';
		} );
	}

	run();
}() );
