/**
 * init getUserMedia
 * init THREE.js scene
 * init WebWorker
 * --> init camera matrix
 * 
 * function updateScene()
 * --> function addItem()
 * --> function removeItem()
 *
 * process()
 * render() 
 *
 *
 * handle resize
 * 
 **/

const settings = {
    interpolationFactor: 8,
    autoRotate: {
        x: 0.01,
        y: 0.01,
        z: 0.01,
    },
    transition: {
        duration: 2000
    }
}

var state = {
    itemOpacity: 0,
    currentMarkerId: undefined,
    projectionMatrix: undefined,
}

let trackedMatrix = {
    // for interpolation
    delta: [
        0,0,0,0,
        0,0,0,0,
        0,0,0,0,
        0,0,0,0
    ],
    interpolated: [
        0,0,0,0,
        0,0,0,0,
        0,0,0,0,
        0,0,0,0        
    ]
}


let colors = {
    'marker33': new THREE.Color( 0xffffff ),
    'marker34': new THREE.Color( 0xffffff ),
    'marker0': new THREE.Color( 0xffffff ),
    'marker3': new THREE.Color( 0xffffff ),
}


let ARVideo = document.getElementById( 'arvideo' );
let texture = new THREE.VideoTexture( ARVideo );

let material = new THREE.MeshStandardMaterial( { 
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.2,
    map: texture,
    transparent: true
} );


let autoRotate;

let ARObject = undefined;
let ground;

let stats = {}

let transition;


let video = document.getElementById( 'video' );

let renderer;
let camera;
let root;

let canvas_process = document.createElement( 'canvas' );
let context_process = canvas_process.getContext( '2d', { alpha: false } );

let vw, vh;
let sw, sh;
let pscale, sscale;
let w, h;
let pw, ph;
let ox, oy;
let worker;


let init = function() {
    // initStats();
    initScene();
    initUserMedia();
}

let initUserMedia = function() {
    if( !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia ) {
        return false;
    }

    let hint = {
        audio: false,
        video: true
    };

    if( window.innerWidth < 800 ) {
        let videoWidth = ( window.innerWidth < window.innerHeight ) ? 240 : 360;
        let videoHeight = ( window.innerWidth < window.innerHeight ) ? 360 : 240;

        console.log( videoWidth, videoHeight );

        hint = {
            audio: false,
            video: {
                facingMode: 'environment',                
                width: { min: videoWidth, max: videoWidth }
            },
        };

        console.log( hint );        
    }
    
    navigator.mediaDevices.getUserMedia( hint )
        .then( function( stream ) {
            video.addEventListener( 'loadedmetadata', () => {
                video.play();

                console.log( 'video', video, video.videoWidth, video.videoHeight );

                initTracking();

                tick();
                process();
            } );

            video.srcObject = stream;            
    } );
}

let initScene = function() {
    /**
     * RENDERER
     */
    renderer = new THREE.WebGLRenderer( { 
        alpha: true, 
        antialias: true 
    } );
    
    renderer.setPixelRatio( window.devicePixelRatio );

    renderer.domElement.setAttribute( 'id', 'canvas' );
    document.getElementById( 'app' ).appendChild( renderer.domElement );

    
/**
 * SCENE
 */
    let scene = new THREE.Scene();

    window.scene = scene;
    window.THREE = THREE;


/**
 * ROOT
 */    
    root = new THREE.Object3D();
    root.matrixAutoUpdate = false;
    
    scene.add( root );   



/**
 * LIGHTS
 */
    const light = new THREE.AmbientLight( 0xcccccc );
    scene.add( light );


    const light2 = new THREE.PointLight( 0xeeeeee );
    light2.position.set( -5, 10, 10 );  
    root.add( light2 ); 


    const light3 = new THREE.PointLight( 0xcccccc );
    light3.position.set( 5, -10, 10 );
    scene.add( light3 ); 



    // let sphereSize = 0.1;
    // let pointLightHelper2 = new THREE.PointLightHelper( light2, sphereSize );
    // scene.add( pointLightHelper2 );
    // let pointLightHelper3 = new THREE.PointLightHelper( light3, sphereSize );
    // scene.add( pointLightHelper3 );    
    
/**
 * CAMERA
 */    
    camera = new THREE.Camera();
    camera.matrixAutoUpdate = false;
    scene.add( camera );

    
 



/**
 * OBJECT
 */     
    ARVideo.play();


/**
 * GROUND
 */


    let groundGeometry = new THREE.PlaneBufferGeometry( 1, 1, 1 );

    // Object 1
    let groundMaterial = new THREE.MeshLambertMaterial( {
        color: new THREE.Color( 0x000000 ),
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        alphaMap: new THREE.TextureLoader().load( 'img/shadow.png' )
    } )

    ground = new THREE.Mesh( groundGeometry, groundMaterial ); 

    ground.name = 'ground';
    ground.position.x = 0;
    ground.position.y = 0;
    ground.position.z = 0;

    ground.scale.set( 10, 10, 10 );

    root.add( ground ); 


/**
 * AUTOROTATE
 */    
    autoRotate = new THREE.Object3D();
    root.add( autoRotate ); 

}

let initTracking = function() {
    vw = video.videoWidth;
    vh = video.videoHeight;

    pscale = 1;
    sscale = 1;

    sw = vw * sscale;
    sh = vh * sscale;

    renderer.domElement.width = sw;
    renderer.domElement.height = sh;
    w = vw * pscale;
    h = vh * pscale;
    pw = Math.max( w, h / 3 * 4 ); // this is still needed because processing happens in landscape orientation
    ph = Math.max( h, w / 4 * 3 ); // this is still needed because processing happens in landscape orientation
    ox = ( pw - w ) / 2;
    oy = ( ph - h ) / 2;


    canvas_process.width = pw;
    canvas_process.height = ph;


    renderer.setSize( sw, sh );


    console.table( [
        ['vw', vw],
        ['vh', vh],
        ['pscale', pscale],
        ['sscale', sscale],
        ['sw', sw],
        ['sh', sh],
        ['w', w],
        ['h', h],
        ['pw', pw],
        ['ph', ph],
        ['ox', ox],
        ['oy', oy]
    ] );


    // service worker
    worker = new Worker( 'js/worker.js' );

    worker.postMessage( { 
        type: 'load', 
        pw: pw, 
        ph: ph
    } );

    worker.onmessage = function( event ) {
        let data = event.data; 

        switch( data.type ) {
            case 'loaded': {                    
                let cameraProjectionMatrix = JSON.parse( data.cameraProjectionMatrix );
                let ratioW = pw / w;
                let ratioH = ph / h;
                
                cameraProjectionMatrix[0] *= ratioW;
                cameraProjectionMatrix[4] *= ratioW;
                cameraProjectionMatrix[8] *= ratioW;
                cameraProjectionMatrix[12] *= ratioW;
                cameraProjectionMatrix[1] *= ratioH;
                cameraProjectionMatrix[5] *= ratioH;
                cameraProjectionMatrix[9] *= ratioH;
                cameraProjectionMatrix[13] *= ratioH;
                
                // set camera matrix to detected camera projection matrix
                setMatrix( camera.projectionMatrix, cameraProjectionMatrix );

                document.body.classList.remove( 'loading' );
                
                break;
            }

            case 'found': {
                updateScene( data );
                
                break;
            }

            case 'not found': {
                updateScene( null );
                
                break;
            }
        }
        
        /**
         * Callback
         */
        if( stats['worker'] ) {
            stats['worker'].update();
        }
        
        process();
    };
}

let initStats = function() {
    stats['main'] = new Stats();
    stats['main'].showPanel( 0 );
    document.getElementById( 'stats1' ).appendChild( stats['main'].dom );

    stats['worker'] = new Stats();
    stats['worker'].showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.getElementById( 'stats2' ).appendChild( stats['worker'].dom );    
}

let updateScene = function( data ) {
    // nothing found
    if( !data || data.markerId < 0 ) {
        state.projectionMatrix = undefined;

        if( state.currentMarkerId ) {
            state.currentMarkerId = undefined;        

            removeItem();
        }

        state.currentMarkerId = undefined;                

    // marker found
    } else {
        state.projectionMatrix = JSON.parse( data.matrixGL_RH );

        if( !state.currentMarkerId ) {
            state.currentMarkerId = data.markerId;        
            
            addItem();
        }

        state.currentMarkerId = data.markerId;        
    }
};

let removeItem = function() {
    console.log( 'removeItem()', root.children.length );

    document.body.classList.remove( 'found' );    

    if( transition ) {
        transition.pause();
    }

    state.itemOpacity = 0;

    let item = scene.getObjectByName( 'item', true );   

    item.geometry.dispose(); 
    item.material.dispose(); 
    autoRotate.remove( item );
    autoRotate.remove( ARObject );

    ARObject = undefined;
    state.currentMarkerId = undefined;    
}

let addItem = function() {
    console.log( 'addItem()', state.currentMarkerId );

    document.body.classList.add( 'found' );    

    state.itemOpacity = 0;    

    let geometry = new THREE.CylinderBufferGeometry( 1, 1, 0.25, 32, 1 );
    geometry.center();

    // Object 1
    let _material = material.clone();
    _material.color = colors[ 'marker' + state.currentMarkerId ];

    let object = new THREE.Mesh( geometry, _material ); 
    object.name = 'item';

    object.rotation.y = THREE.Math.degToRad( 90 )

    object.position.x = 0;
    object.position.y = 0;
    object.position.z = 3.5;

    object.scale.set( 2, 2, 2 );


    ARObject = object;
    autoRotate.add( ARObject );    

    transition = anime( {
        targets: state,
        itemOpacity: [0,1],
        duration: settings.transition.duration,
        round: 1000
    } );    
}



/** 
 * Renders the THREE.js scene
 */
let draw = function() {

    /**e
     * Callback 
     */
    if( stats['main'] ) {
        stats['main'].update();
    }
    

    // marker not found
    if( state.currentMarkerId === undefined ) {

    } else {

        if( ARObject ) {
            ARObject.material.opacity = state.itemOpacity;
        }

        // interpolate matrix
        for( let i = 0; i < 16; i++ ) { 
            trackedMatrix.delta[i] = state.projectionMatrix[i] - trackedMatrix.interpolated[i];            
            trackedMatrix.interpolated[i] = trackedMatrix.interpolated[i] + ( trackedMatrix.delta[i] / settings.interpolationFactor );
        }        

        // set matrix of 'root' by detected 'world' matrix
        setMatrix( root.matrix, trackedMatrix.interpolated );

        // autorotate
        if( ARObject ) {
            autoRotate.rotation.z = autoRotate.rotation.z + settings.autoRotate.z;
        }
    }

    ground.material.opacity = state.itemOpacity * 0.4;    
    
    renderer.render( scene, camera );
};



/**
 * This is called on every frame 
 */ 
let process = function() {
    // clear canvas
    context_process.fillStyle = 'black';
    context_process.fillRect( 0, 0, pw, ph );
    
    // draw video to canvas
    context_process.drawImage( video, 0, 0, vw, vh, ox, oy, w, h );

    // send video frame to worker
    let imageData = context_process.getImageData( 0, 0, pw, ph );
    worker.postMessage( 
        { 
            type: 'process', 
            imagedata: imageData 
        }, 
        [ 
            imageData.data.buffer
        ]
    );
}


let tick = function() {
    draw();
    
    requestAnimationFrame( function() {
        tick(); 
    } );
};




/**
 * Helper function
 */
let setMatrix = function( matrix, value ) {
    let array = [];
    
    for( let key in value ) {
        array[key] = value[key];
    }
    
    if( typeof matrix.elements.set === 'function' ) {
        matrix.elements.set( array );
    } else {
        matrix.elements = [].slice.call( array );
    }
};





init();