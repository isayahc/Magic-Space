import * as THREE from '/node_modules/three/build/three.module.js';
import { OrbitControls } from '/node_modules/three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
export function createPreview(container){
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(30,1,.1,100);
  camera.position.set(0,1.2,4.7);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  container.append(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.95,0);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2.5;controls.maxDistance=7;controls.maxPolarAngle=Math.PI*.6;
  scene.add(new THREE.HemisphereLight('#d5f2ef','#44515d',3));
  for(const [color,intensity,x,y,z] of [['#fff0d6',4,-3,5,4],['#b6e8e4',3,3,2,-2]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(x,y,z);scene.add(light);}
  let model,mixer,actions={},playing='idle',token=0,loadedURL=null;
  const loader=new GLTFLoader();
  function dispose(object){object?.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}}});}
  async function load(c){
    const key=`${c.walk}|${c.idle}`;if(key===loadedURL)return;
    const own=++token;
    const [walk,idle]=await Promise.all([loader.loadAsync(c.walk),loader.loadAsync(c.idle)]);
    if(own!==token){dispose(walk.scene);dispose(idle.scene);return;}
    if(model){scene.remove(model);mixer?.stopAllAction();dispose(model);}
    model=walk.scene;model.rotation.y=-Math.PI/2;
    const bounds=new THREE.Box3().setFromObject(model),h=bounds.getSize(new THREE.Vector3()).y;
    if(!Number.isFinite(h)||h<=0)throw new Error('Character has invalid bounds');
    model.scale.multiplyScalar(1.8/h);
    const b=new THREE.Box3().setFromObject(model),center=b.getCenter(new THREE.Vector3());
    model.position.set(-center.x,-b.min.y,-center.z);scene.add(model);
    mixer=new THREE.AnimationMixer(model);actions={};
    if(walk.animations[0])actions.walk=mixer.clipAction(walk.animations[0]);
    if(idle.animations[0])actions.idle=mixer.clipAction(idle.animations[0]);
    actions[playing]?.play();dispose(idle.scene);loadedURL=key;
  }
  function resize(){const {width,height}=container.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(container);
  let before=performance.now();
  renderer.setAnimationLoop(now=>{mixer?.update(Math.min((now-before)/1000,.05));before=now;controls.update();renderer.render(scene,camera);});
  return {load,pose(mode){actions[playing]?.fadeOut(.2);playing=mode;actions[mode]?.reset().fadeIn(.2).play();},reset(){camera.position.set(0,1.2,4.7);controls.target.set(0,.95,0);controls.update();},
    capture(){
      // A consistent, UI-free reference of the actual character, rendered at portrait resolution.
      const size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio(),aspect=camera.aspect,position=camera.position.clone(),target=controls.target.clone();
      camera.position.set(0,1.1,4.7);controls.target.set(0,.95,0);controls.update();camera.aspect=2/3;camera.updateProjectionMatrix();
      renderer.setPixelRatio(1);renderer.setSize(768,1152,false);renderer.setClearColor('#e5e7e4',1);renderer.render(scene,camera);
      const image=renderer.domElement.toDataURL('image/png');
      camera.position.copy(position);controls.target.copy(target);controls.update();camera.aspect=aspect;camera.updateProjectionMatrix();renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y);renderer.setClearColor(0,0);
      return image;
    },snapshot(){let skins=0;model?.traverse(o=>{if(o.isSkinnedMesh)skins++;});const bone=model?.getObjectByName('L_Thigh')||model?.getObjectByName('Hip');return {loadedURL,skins,mode:playing,bone:bone?.quaternion.toArray()};}};
}
