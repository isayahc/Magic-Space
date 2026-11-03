import * as THREE from '/node_modules/three/build/three.module.js';
import { ROOM_CENTERS } from './navigation.mjs';

export function createStation(data) {
  const scene=new THREE.Scene();scene.background=new THREE.Color('#06101d');
  const station=new THREE.Group();scene.add(station);
  const materials=new Map(), animated=[],doors=[],pickables=[],walls=[];
  const material=(color,emission=0,opacity=1)=>{
    const key=`${color}/${emission}/${opacity}`;
    if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.48,metalness:.38,emissive:color,emissiveIntensity:emission,transparent:opacity<1,opacity,depthWrite:opacity===1}));
    return materials.get(key);
  };
  const metal=material('#243947'),rim=material('#516776'),ivory=material('#b0bdb6'),black=material('#0b1923'),soil=material('#25342c');
  const boxGeo=new THREE.BoxGeometry(1,1,1);
  function box(parent,x,y,z,w,h,d,mat=metal){const mesh=new THREE.Mesh(boxGeo,mat);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function cylinder(parent,x,y,z,r,h,mat=metal,segments=12){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function ring(parent,x,y,z,r,mat){const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,.035,6,32),mat);mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
  function sign(text,color,width=3,height=.5){
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#0b1924';ctx.fillRect(0,0,768,128);ctx.fillStyle=color;ctx.fillRect(0,0,10,128);ctx.font='bold 52px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text.toUpperCase(),384,68,720);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
  }
  function screen(parent,x,y,z,w=.8,h=.45,color='#65e7f1') {
    box(parent,x,y,z,w+.08,h+.08,.09,black);
    box(parent,x,y,z+.055,w,h,.01,material(color,.8));
    for(let i=0;i<3;i++)box(parent,x-w*.15,y+h*(.25-i*.24),z+.066,w*.55,.025,.01,material('#142f3a'));
  }
  function prop(item,color) {
    const g=new THREE.Group(),glow=material(color,1.8),paint=material(color,.05),green=material('#6ea84d');
    const {type}=item;
    if(type==='console'||type==='labBench'){
      box(g,0,.43,0,1.4,.8,.72,ivory);box(g,0,.88,0,1.55,.12,.95,metal);box(g,0,.45,.37,1.22,.04,.02,paint);
      screen(g,0,1.25,-.27,1,.53,color);box(g,0,.97,.18,.8,.035,.26,black);
      if(type==='labBench')for(let i=0;i<3;i++)cylinder(g,-.48+i*.45,1.05,.22,.09,.25,glow);
    }else if(type==='specimen'||type==='tank'||type==='reactor'){
      const tall=type==='reactor'?2.25:1.7;
      cylinder(g,0,.14,0,.68,.28,metal);cylinder(g,0,tall+.08,0,.68,.18,metal);
      cylinder(g,0,tall/2+.15,0,.51,tall-.15,material(color,.25,.3));
      cylinder(g,0,tall/2+.15,0,.20,tall-.3,glow);
      for(let i=0;i<4;i++){const a=i*Math.PI/2;box(g,Math.cos(a)*.55,tall/2+.1,Math.sin(a)*.55,.09,tall,.09,rim);}
      ring(g,0,.36,0,.56,glow);ring(g,0,tall-.12,0,.56,glow);
      if(type==='reactor'){const rotor=ring(g,0,1.1,0,.68,glow);rotor.rotation.z=.5;animated.push({object:rotor,kind:'reactor'});}
      else {const specimen=new THREE.Mesh(new THREE.IcosahedronGeometry(.28,0),material('#d6fbad',.4));specimen.position.y=.9;g.add(specimen);animated.push({object:specimen,kind:'specimen'});}
    }else if(type==='plantRack'){
      for(const x of [-.65,.65])for(const z of [-.48,.48])box(g,x,.8,z,.06,1.6,.06,rim);
      for(const y of [.3,1.1]){
        box(g,0,y,0,1.45,.18,1.05,ivory);box(g,0,y+.11,0,1.3,.06,.9,soil);
        for(let i=0;i<6;i++){
          const x=(i%3-1)*.42,z=(i<3?-.22:.22);
          cylinder(g,x,y+.3,z,.035,.32,green,5);
          for(let j=0;j<3;j++){
            const leaf=new THREE.Mesh(new THREE.SphereGeometry(.18,5,4),material(j%2?'#91b85c':'#387b52'));
            leaf.scale.set(1,.45,.7);leaf.position.set(x+Math.cos(j*2.1)*.1,y+.38,z+Math.sin(j*2.1)*.1);leaf.rotation.z=j*.6;g.add(leaf);
          }
        }
      }
      box(g,0,1.8,0,1.4,.06,.12,material('#d6abff',2));
    }else if(type==='medBed'){
      box(g,0,.28,0,.9,.5,1.45,metal);box(g,0,.58,0,1.05,.18,1.5,ivory);box(g,0,.71,.12,.87,.12,1.1,material('#69bcb4'));box(g,0,.79,-.51,.72,.16,.33,ivory);
      box(g,.62,.8,-.55,.05,1.6,.05,rim);screen(g,.62,1.5,-.55,.4,.3,color);
    }else if(type==='crate'){
      box(g,0,.48,0,1.15,.95,1.1,material('#bd7844'));box(g,0,.99,0,1.23,.09,1.18,rim);
      for(const x of [-.4,.4])box(g,x,.5,.56,.07,.87,.025,metal);
      box(g,0,.55,.58,.36,.17,.02,ivory);box(g,0,.38,.595,.24,.03,.01,black);
    }else if(type==='locker'||type==='server'){
      box(g,0,1,0,1.05,2,.7,metal);box(g,0,1,.36,.91,1.84,.035,type==='locker'?ivory:black);
      for(let i=0;i<6;i++){box(g,-.1,.35+i*.24,.4,.63,.07,.02,rim);box(g,.33,.35+i*.24,.42,.05,.05,.015,glow);}
    }else if(type==='hologram'){
      cylinder(g,0,.4,0,.65,.8,metal);ring(g,0,.82,0,.57,glow);
      const holo=new THREE.Mesh(new THREE.IcosahedronGeometry(.53,1),new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:.7}));holo.position.y=1.5;g.add(holo);animated.push({object:holo,kind:'hologram'});
      cylinder(g,0,1.2,0,.4,.7,material(color,.4,.09));
    }
    g.rotation.y=THREE.MathUtils.degToRad(item.rotation);return g;
  }
  // Tile batches keep the scene affordable while preserving grout and color variation.
  const tiles=[],tileColors=[];
  for(let x=-11;x<11;x++)for(let z=-12;z<=12;z++){
    const room=data.rooms.find(r=>{const [cx,cz]=ROOM_CENTERS[r.id];return Math.abs(x+.5-cx)<4&&Math.abs(z-cz)<3.5;});
    const corridor=Math.abs(x+.5)<2||[-9,0,9].some(cz=>Math.abs(z-cz)<1.4&&Math.abs(x+.5)<3.5);
    if(room||corridor){tiles.push([x+.5,-.07,z]);const c=new THREE.Color(room?'#758d94':'#334b58');if(room)c.lerp(new THREE.Color(room.accent),.09);c.multiplyScalar(.9+((x*13+z*7+1000)%5)*.025);tileColors.push(c);}
  }
  const floor=new THREE.InstancedMesh(boxGeo,material('#ffffff'),tiles.length),matrix=new THREE.Matrix4();
  tiles.forEach(([x,y,z],i)=>{matrix.makeScale(.975,.14,.975);matrix.setPosition(x,y,z);floor.setMatrixAt(i,matrix);floor.setColorAt(i,tileColors[i]);});floor.receiveShadow=true;station.add(floor);
  box(station,0,-.5,0,4,.85,26,metal);
  for(let z=-12;z<=12;z+=2){box(station,-1.8,.025,z,.06,.02,.75,material('#78f2df',1.2));box(station,1.8,.025,z,.06,.02,.75,material('#78f2df',1.2));}
  for(const [index,room] of data.rooms.entries()){
    const [cx,cz]=ROOM_CENTERS[room.id],g=new THREE.Group();g.position.set(cx,0,cz);station.add(g);
    const accent=material(room.accent,1.6),paint=material(room.accent,.03);
    box(g,0,-.5,0,8.3,.9,7.3,metal);box(g,0,-.9,0,7.3,.25,6.3,black);
    // North and outward bulkheads are tall; near walls remain cut away.
    const wallGroup=new THREE.Group();g.add(wallGroup);walls.push(wallGroup);
    box(wallGroup,0,1.15,-3.5,8.25,2.3,.22,metal);box(wallGroup,0,2.35,-3.5,8.35,.15,.35,rim);
    for(let x=-3;x<=3;x+=2){
      box(wallGroup,x,1.5,-3.35,1.65,.9,.06,black);box(wallGroup,x,1.52,-3.31,1.42,.66,.025,material('#27485a',.2));
      box(wallGroup,x,2.05,-3.28,1.5,.035,.03,accent);
      box(wallGroup,x-1,.95,-3.25,.12,1.8,.22,rim);
    }
    const outer=cx<0?-4:4;
    box(wallGroup,outer,1,0,.2,2,7,metal);
    for(let z=-2.5;z<=2.5;z+=2.5){box(wallGroup,outer*.98,1.3,z,.04,.7,1.7,material('#29495a',.15));box(wallGroup,outer*.96,1.85,z,.04,.035,1.8,accent);}
    box(g,0,.13,3.5,8.1,.25,.18,rim);box(g,0,.28,3.5,7.8,.035,.05,accent);
    const inner=cx<0?4:-4;
    for(const side of [-1,1]){box(g,inner,.55,side*2.42,.2,1.1,2.15,metal);box(g,inner,1.12,side*2.42,.25,.06,2.15,rim);}
    // Sliding double airlock: leaves move along Z, preserving a 2m-wide passage.
    const frame=new THREE.Group();frame.position.set(cx+inner,0,cz);station.add(frame);
    for(const z of [-1.25,1.25]){box(frame,0,1.15,z,.38,2.3,.25,rim);box(frame,-.21,1.15,z,.035,1.65,.06,accent);}
    box(frame,0,2.35,0,.4,.23,2.75,rim);
    const leaves=[];
    for(const side of [-1,1]){const leaf=box(frame,0,1.08,side*.55,.18,2.1,1.08,metal);leaves.push(leaf);box(leaf,0,0,0,1.1,.025,.75,accent);}
    doors.push({x:cx+inner,z:cz,leaves,open:0});
    box(station,(cx<0?-2.7:2.7),-.45,cz,1.6,.8,2.8,metal);
    const label=sign(`${String(index+1).padStart(2,'0')} / ${room.id}`,room.accent,4.5,.65);label.rotation.x=-Math.PI/2;label.position.set(cx,.015,cz+.95);station.add(label);
    const badge=sign(room.name,room.accent,5,.48);badge.position.set(0,2.05,-3.14);g.add(badge);
    const pick=box(g,0,-.02,0,7.8,.04,6.8,new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));pick.userData.room=room;pickables.push(pick);
    for(const item of room.props){const object=prop(item,room.accent);object.position.set(item.x,0,item.z);g.add(object);}
    const light=new THREE.PointLight(room.accent,18,12,2);light.position.set(cx,3.2,cz);scene.add(light);
    // Service pipes, external bracing and floor safety stripes.
    for(let i=0;i<6;i++)box(g,-3.3+i*1.3,-.55,3.72,.4,.22,.15,rim);
    for(let i=0;i<5;i++){const stripe=box(g,inner*.82,.02,-.8+i*.4,.35,.02,.13,material('#d5ac58'));stripe.rotation.y=.5;}
    for(const offset of [-.25,.25]){const pipe=cylinder(wallGroup,outer*.92,1.9,0,.075,6.5,paint,8);pipe.rotation.x=Math.PI/2;pipe.position.x+=offset;}
  }
  // Docking airlock, antenna mast and solar wings make the silhouette a spacecraft.
  const dock=new THREE.Group();dock.position.set(0,0,13);station.add(dock);
  box(dock,0,.8,1,3.5,1.8,2,metal);box(dock,0,1,2.05,2.6,1.5,.12,rim);box(dock,0,1,2.13,1.6,1.2,.04,black);box(dock,0,1,2.16,.04,1.1,.02,material('#ffa36c',2));
  for(const side of [-1,1]){
    box(station,side*13,-.6,-9,4,.18,.22,rim);
    const solar=new THREE.Group();solar.position.set(side*15,-.5,-9);solar.rotation.z=side*.12;station.add(solar);
    box(solar,0,0,0,5,.13,9,metal);
    for(let x=-2;x<=2;x++)for(let z=-4;z<=4;z++)box(solar,x,.09,z,.92,.03,.92,material('#18355a',.1));
    for(let z=-4.5;z<=4.5;z+=1)box(solar,0,.13,z,5.1,.02,.025,rim);
  }
  cylinder(station,-10,2.8,-12,.07,3.5,rim,8);const dish=new THREE.Mesh(new THREE.SphereGeometry(.75,16,8,0,Math.PI*2,0,Math.PI*.4),ivory);dish.position.set(-10,4.2,-12);dish.rotation.z=.5;station.add(dish);
  scene.add(new THREE.HemisphereLight('#c0e5ff','#173441',1.6));
  const sun=new THREE.DirectionalLight('#ffe1b7',3.8);sun.position.set(-12,25,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:1,far:80});sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;scene.add(sun);
  const fill=new THREE.DirectionalLight('#70baff',1.6);fill.position.set(15,15,-20);scene.add(fill);
  // Seeded stars, so screenshots and live views share the same sky.
  let seed=721;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const starGeo=new THREE.BufferGeometry(),positions=[];
  for(let i=0;i<1800;i++){const a=random()*Math.PI*2,z=random()*2-1,r=85+random()*35,s=Math.sqrt(1-z*z);positions.push(Math.cos(a)*s*r,z*r,Math.sin(a)*s*r);}
  starGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:'#b2d8ec',size:.12,transparent:true,opacity:.75,sizeAttenuation:true})));
  const planet=new THREE.Mesh(new THREE.SphereGeometry(25,64,48),new THREE.ShaderMaterial({
    vertexShader:'varying vec3 p;varying vec3 n;void main(){p=position;n=normalize(normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 p;varying vec3 n;
      float hash(vec3 q){return fract(sin(dot(q,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 q){vec3 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 q=p*.18;float v=noise(q)*.6+noise(q*2.)*.25+noise(q*4.)*.15;vec3 col=mix(vec3(.018,.09,.20),vec3(.09,.28,.36),smoothstep(.47,.62,v));float clouds=smoothstep(.56,.7,noise(q*2.1+9.)*.65+noise(q*5.)*.35);col=mix(col,vec3(.36,.60,.72),clouds*.75);float light=max(.12,dot(n,normalize(vec3(-.6,1.,.6))));gl_FragColor=vec4(col*light,1.);}`,
  }));planet.position.set(6,-36,-16);scene.add(planet);
  const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(25.6,48,32),new THREE.MeshBasicMaterial({color:'#398fc4',transparent:true,opacity:.12,side:THREE.BackSide,depthWrite:false}));atmosphere.position.copy(planet.position);scene.add(atmosphere);
  return {scene,station,doors,pickables,walls,update(time,crew){
    animated.forEach(({object,kind})=>{object.rotation.y=time*(kind==='reactor'?1:.3);if(kind==='specimen')object.rotation.z=Math.sin(time)*.2;});
    doors.forEach(d=>{const near=crew.some(c=>Math.hypot(c.position.x-d.x,c.position.z-d.z)<2.1);d.open=THREE.MathUtils.lerp(d.open,near?1:0,.15);d.leaves.forEach((leaf,i)=>{leaf.position.z=(i===0?-1:1)*(.55+d.open*1.05);});});
  }};
}
