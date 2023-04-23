import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass.js';
import modelLoader from './src/GLTFLoader'
import { Pathfinding } from 'three-pathfinding';

const width = window.innerWidth
const height = window.innerHeight
const aspect = width / height
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera( 75, aspect, 0.1, 1000 )
// const camera = new THREE.OrthographicCamera( - aspect, aspect, 1, - 1, 0.1, 1000 )
// camera.zoom = 0.2;

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#webgl') })
renderer.setSize( width, height )

const composer = new EffectComposer( renderer );
const renderPixelatedPass = new RenderPixelatedPass( 5, scene, camera );
renderPixelatedPass.depthEdgeStrength = 0;
renderPixelatedPass.normalEdgeStrength = 0;
composer.addPass( renderPixelatedPass );    

const navmesh = await modelLoader('./src/models/navmesh.glb')
const ybotModel = await modelLoader('./src/models/ybot.glb')
const npcModel = await modelLoader('./src/models/tpose.glb')
const ybot = ybotModel.scene
console.log(ybot)

const ybotMixer = new THREE.AnimationMixer(ybot)
const idleAnimation = ybotMixer.clipAction(ybotModel.animations[0])
const runAnimation = ybotMixer.clipAction(ybotModel.animations[1])
let lastAction, activeAction

activeAction = idleAnimation
idleAnimation.play()

const npc = npcModel.scene.children[0]
npc.position.set(5,0,-5)
npc.userData.isNpc = true

const dLight = new THREE.DirectionalLight(0xffffff, 1)
const aLight = new THREE.AmbientLight(0xffffff, 0.5)

// const controls = new OrbitControls(camera, renderer.domElement);

scene.add(ybot)
scene.add(npc)
scene.add(navmesh.scene)
scene.add(aLight,dLight)
scene.background = new THREE.Color( 0x87CEFA );

renderer.render( scene, camera )

const mousePosition = new THREE.Vector2()
const raycaster = new THREE.Raycaster()

const navWireframe = new THREE.Mesh(
    navmesh.scene.getObjectByName('navmesh').geometry, 
    new THREE.MeshBasicMaterial({
        color: 0x808080,
        wireframe: true,
        transparent: true,
        opacity: 0.5
    })
);


const pathfinding = new Pathfinding()
const targetQuaternion = new THREE.Quaternion()
const rotationMatrix = new THREE.Matrix4()
const clock = new THREE.Clock()

scene.add(navWireframe)

const zone = Pathfinding.createZone(navWireframe.geometry);

let groupID, path, toNpc
const startPosition = ybot.position
const ZONE = 'ground'
const SPEED = 5

pathfinding.setZoneData( ZONE, zone );

groupID = pathfinding.getGroup( ZONE, startPosition);

window.addEventListener('mousemove', e => {
    mousePosition.x = (e.clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mousePosition, camera);
    const intersects = raycaster.intersectObjects( scene.children )
    if( intersects.length > 0 && intersects[0].object.userData.isNpc ){
        intersects[0].object.material.color.set( 0xffffff * Math.random() );
    }
})

window.addEventListener('click', e => {

    mousePosition.x = (e.clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mousePosition, camera);
    const intersects = raycaster.intersectObjects(scene.children)

    if( !(intersects||[]).length ) return

    let to 
    if(intersects[0].object.userData.isNpc) {
        to = intersects[0].object.position
        toNpc = true
    } 
    else{ 
        to = intersects[0].point
        toNpc = false
    } 
    const node = pathfinding.getClosestNode(startPosition, ZONE, groupID)
    path = pathfinding.findPath( startPosition, to, ZONE, groupID )
    if (!path) path = pathfinding.findPath( node.centroid, to, ZONE, groupID )

    const geometry = new THREE.BoxGeometry( 0.1, 1, 0.1 );
    const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
    const cube = new THREE.Mesh( geometry, material );
    const cubeName = 'target'
    cube.name = cubeName
    cube.position.copy(to)
    scene.remove(scene.getObjectByName(cubeName))
    scene.add(cube)

})

window.addEventListener( 'resize', () => {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
  
  })

function moveToPath ( dt ) {
    if ( !(path||[]).length ) return setAction(idleAnimation)
    setAction(runAnimation)
    let targetPosition = path[ 0 ];

    rotationMatrix.lookAt(targetPosition, ybot.position, ybot.up)
    ybot.quaternion.rotateTowards(targetQuaternion, dt * SPEED * 1.5)
    targetQuaternion.setFromRotationMatrix(rotationMatrix)

    let dir = new THREE.Vector3().subVectors(targetPosition, startPosition);
    const distMax = dir.length();
    dir.normalize();
    let distPassed = 0;

    if(distMax){
        if(toNpc && distMax < 1 && path.length == 1) return path.shift()
        distPassed += SPEED * dt;
        startPosition.copy(startPosition).addScaledVector(dir, THREE.MathUtils.clamp(distPassed, 0, distMax))
    }else path.shift()
            
}

const setAction = toAction => {
    if (toAction != activeAction) {
        lastAction = activeAction
        activeAction = toAction
        //lastAction.stop()
        lastAction.fadeOut(0.2)
        activeAction.reset()
        activeAction.fadeIn(0.2)
        activeAction.play()
    }
}

function animate() {
    const dt = clock.getDelta()
    moveToPath(dt)
    // controls.update()
    renderer.render( scene, camera )
    // composer.render()
    ybotMixer.update(dt)
    camera.position.copy(ybot.position).add(new THREE.Vector3(5, 5, 5));
    camera.lookAt(ybot.position)
    camera.updateProjectionMatrix()

    requestAnimationFrame( animate )
}

animate()

