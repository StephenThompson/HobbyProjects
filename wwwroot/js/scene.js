import * as THREE from '../js/three.module.js';
import { OrbitControls } from '../js/OrbitControls.js';
import { Ocean } from '../js/ocean.js';

var scene;
var camera;
var renderer;
var container;
var cameraControls;
var size = 720;
var cameraControls;
var water;
var waterGeometry;
var sun;

function animate() {
    requestAnimationFrame(animate);
    render();
}

function createScene() {
    container = document.getElementById('threejscontainer');
    if (!container) {
        return;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xd0e0f0 );


    renderer = new THREE.WebGLRenderer();
    // renderer.setSize(container.width, container.height);
    renderer.setSize(size, size);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    
    // CONTROLS
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.x = -2;
    camera.position.y = 2.5;
    camera.position.z = -1.5;
    cameraControls = new OrbitControls( camera, renderer.domElement );
    cameraControls.addEventListener( 'change', render );
    
    // LIGHT
    sun = new THREE.Vector3(1.0, 1.0, 1.0);

    // WATER
    const params = {
        color: '#0a0fff',
        scale: 4,
        flowX: 1,
        flowY: 1
    };

    waterGeometry = new THREE.PlaneGeometry( 4, 4, 50, 50 );
    water = new Ocean( waterGeometry, {
        color: params.color,
        scale: params.scale,
        flowDirection: new THREE.Vector2( params.flowX, params.flowY ),
        textureWidth: 1024,
        textureHeight: 1024
    } );

    water.rotation.x = Math.PI * - 0.5;
    scene.add( water );

    animate();
}

function render()
{
    renderer.render(scene, camera);
}

function setSunDirection(elevation, azimuth) {
    const phi = THREE.MathUtils.degToRad( 90 - elevation );
    const theta = THREE.MathUtils.degToRad( azimuth );
    sun.setFromSphericalCoords( 1, phi, theta );
    
    console.log(elevation, azimuth, " :: " , sun.x, sun.y, sun.z);
    water.material.uniforms[ '_SunDirection' ].value.copy( sun ).normalize();
    // water.material.uniforms[ '_sunDirection' ].value.copy( new THREE.Vector3(1,1,1) ).normalize();
}

window.scene = {
    create: () => { createScene(); },
    changeSunDirection: (azimuth, elevation) => { setSunDirection(azimuth, elevation) }
};

window.onload = createScene;