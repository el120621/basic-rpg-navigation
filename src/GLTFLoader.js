import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
const loader = new GLTFLoader()

export default function modelLoader( url ) {
    return new Promise((resolve, reject) => {
      loader.load(url, (scene)=> resolve(scene), null, reject);
    });
}
