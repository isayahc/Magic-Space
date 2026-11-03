export const ROOM_CENTERS = {
  research: [-7,-9], hydroponics: [7,-9], engineering: [-7,0],
  medical: [7,0], cargo: [-7,9], command: [7,9],
};
export const TYPES = ['console','labBench','specimen','plantRack','reactor','medBed','crate','locker','tank','server','hologram'];
export function validateBlueprint(data) {
  if (!data || typeof data.name !== 'string' || typeof data.tagline !== 'string') throw new Error('Missing station identity');
  if (!Array.isArray(data.rooms) || data.rooms.length !== 6 || new Set(data.rooms.map(r=>r.id)).size !== 6) throw new Error('Expected six unique departments');
  for (const room of data.rooms) {
    if (!ROOM_CENTERS[room.id] || !/^#[0-9a-f]{6}$/i.test(room.accent) || typeof room.name !== 'string' || typeof room.description !== 'string') throw new Error('Invalid department');
    if (!Array.isArray(room.props) || room.props.length !== 6) throw new Error('Each department needs six props');
    const slots = new Set();
    for (const prop of room.props) {
      if (!TYPES.includes(prop.type) || ![-2.5,0,2.5].includes(prop.x) || ![-2.2,2.2].includes(prop.z) || ![0,90,180,270].includes(prop.rotation) || typeof prop.label !== 'string') throw new Error('Invalid prop');
      const slot = `${prop.x},${prop.z}`;
      if(slots.has(slot)) throw new Error('Overlapping props');
      slots.add(slot);
    }
  }
  if (!Array.isArray(data.crew) || data.crew.length !== 3 || new Set(data.crew.map(c=>c.id)).size!==3) throw new Error('Expected three crew');
  for (const person of data.crew) {
    if (!['astronaut','engineer','botanist'].includes(person.id) || typeof person.callsign !== 'string' || typeof person.role !== 'string' || !Array.isArray(person.tasks) || person.tasks.length < 4 || person.tasks.length > 6) throw new Error('Invalid crew');
    for (const task of person.tasks) if(!ROOM_CENTERS[task.room] || typeof task.action !== 'string' || !Number.isInteger(task.seconds) || task.seconds < 4 || task.seconds > 12) throw new Error('Invalid task');
    if(new Set(person.tasks.map(t=>t.room)).size < 3) throw new Error('Crew must visit three departments');
  }
  if(!Array.isArray(data.events) || data.events.length !== 4 || data.events.some((e,i)=>e.at!==[15,40,70,100][i] || typeof e.title!=='string' || typeof e.detail!=='string')) throw new Error('Invalid event schedule');
  return data;
}

// Half-meter navigation cells; geometry and navigation share this floor definition.
export function onFloor(x,z) {
  if(Math.abs(x)<=2 && Math.abs(z)<=13) return true;
  return Object.values(ROOM_CENTERS).some(([cx,cz]) =>
    (Math.abs(x-cx)<=4 && Math.abs(z-cz)<=3.5) || (Math.abs(x)<=3.5 && Math.abs(z-cz)<=1.4));
}
export function makeNavigation(data) {
  const obstacles=data.rooms.flatMap(r=>r.props.map(p=>({x:ROOM_CENTERS[r.id][0]+p.x,z:ROOM_CENTERS[r.id][1]+p.z})));
  const key=(x,z)=>`${x},${z}`;
  const cells=new Map();
  for(let x=-22;x<=22;x++)for(let z=-26;z<=26;z++) {
    const wx=x/2,wz=z/2;
    // Inset floor edges by the crew radius and avoid the equipment footprint.
    if([[.3,.3],[-.3,.3],[.3,-.3],[-.3,-.3]].every(([dx,dz])=>onFloor(wx+dx,wz+dz)) && !obstacles.some(p=>Math.abs(p.x-wx)<1.05 && Math.abs(p.z-wz)<1.05)) cells.set(key(x,z),[wx,wz]);
  }
  function path(start,end) {
    const nearest=point=>[...cells.keys()].reduce((best,k)=>{
      const p=cells.get(k),b=cells.get(best);
      return Math.hypot(p[0]-point[0],p[1]-point[1])<Math.hypot(b[0]-point[0],b[1]-point[1])?k:best;
    });
    const from=nearest(start),to=nearest(end),queue=[from],previous=new Map([[from,null]]);
    for(let i=0;i<queue.length&&!previous.has(to);i++) {
      const k=queue[i],[x,z]=k.split(',').map(Number);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const n=key(x+dx,z+dz);
        if(cells.has(n)&&!previous.has(n)){previous.set(n,k);queue.push(n);}
      }
    }
    if(!previous.has(to)) throw new Error('No safe route between departments');
    const points=[];
    for(let k=to;k!==null;k=previous.get(k))points.push(cells.get(k));
    return points.reverse();
  }
  return {cells,path,obstacles};
}
