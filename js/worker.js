importScripts( 'artoolkitNft.min.js' );

self.onmessage = e => {
    let msg = e.data;
    switch (msg.type) {
        case "load": {
            load(msg);
            return;
        }
        case "process": {
            next = msg.imagedata;
            process();
            return;
        }
    }
};

let next = null;

let ar = null;
let markerResult = null;

function load(msg) {
    let param = new ARCameraParam( '../data/camera_para.dat' );
    param.onload = function () {
        ar = new ARController( msg.pw, msg.ph, param );
        let cameraProjectionMatrix = ar.getCameraMatrix();

        ar.setPatternDetectionMode( artoolkit.AR_MATRIX_CODE_DETECTION );        

        ar.addEventListener( 'getMarker', function( ev ) {
            // console.log( 'getMarker', ev );

            markerResult = {
                type: 'found', 
                matrixGL_RH: JSON.stringify( ev.data.matrixGL_RH ), 
                cameraProjectionMatrix: JSON.stringify( cameraProjectionMatrix ),
                markerId: ev.data.marker.id
            }
        });

        ar.addEventListener( 'markerNum', function ( ev ) {
            // console.log( 'markerNum', ev.markerNum );
        });        

        postMessage( {
            type: 'loaded', 
            cameraProjectionMatrix: JSON.stringify( cameraProjectionMatrix )
        } );
    };
}

function process() {
    markerResult = null;

    if( ar ) {
        ar.process( next );
    }

    if( markerResult ) {
        // console.log( 'found' );

        postMessage( markerResult );
    } else {
        // console.log( 'not found' );

        postMessage( {
            type: 'not found' 
        } );
    }

    next = null;
}