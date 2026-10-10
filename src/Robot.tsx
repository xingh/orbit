import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function Robot({ active = false }: { active?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const [failed, setFailed] = useState(false);
  activeRef.current = active;
  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
    camera.position.set(3.5, 2.6, 5.5); camera.lookAt(0, 1.1, 0);
    scene.add(new THREE.HemisphereLight(0xd4eaff, 0x293039, 2.8));
    const key = new THREE.DirectionalLight(0xffffff, 4); key.position.set(-3, 5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x69e6de, 3); rim.position.set(3, 2, -2); scene.add(rim);
    const metal = new THREE.MeshStandardMaterial({ color: 0x929fa8, metalness: 0.72, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x111c25, metalness: 0.35, roughness: 0.44 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x17212a, roughness: 0.85 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x102a3b, metalness: 0.6, roughness: 0.12, clearcoat: 1 });
    const cyan = new THREE.MeshStandardMaterial({ color: 0x86fff1, emissive: 0x28c5b6, emissiveIntensity: 2 });
    const robot = new THREE.Group(); scene.add(robot);
    function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, group = robot) {
      const object = new THREE.Mesh(geometry, material); object.position.set(x,y,z); group.add(object); return object;
    }
    const cylinder = (r: number, h: number) => new THREE.CylinderGeometry(r, r, h, 64);
    mesh(cylinder(.62, 1.1), metal, 0, .98, 0);
    mesh(cylinder(.64, .08), dark, 0, .46, 0);
    mesh(cylinder(.55, .13), dark, 0, 1.55, 0);
    const head = new THREE.Group(); head.position.y = 1.77; robot.add(head);
    mesh(cylinder(.69, .34), glass, 0, 0, 0, head);
    mesh(cylinder(.72, .08), metal, 0, .21, 0, head);
    mesh(cylinder(.72, .07), metal, 0, -.21, 0, head);
    mesh(cylinder(.6, .07), metal, 0, .28, 0, head);
    for (let i=0;i<8;i++) {
      const angle = i * Math.PI / 4;
      const lens = new THREE.Group(); lens.position.set(Math.sin(angle)*.69, 0, Math.cos(angle)*.69); lens.rotation.y = angle; head.add(lens);
      const bezel = mesh(cylinder(.105, .06), metal, 0, 0, .025, lens); bezel.rotation.x = Math.PI/2;
      const optic = mesh(cylinder(.076, .067), glass, 0, 0, .053, lens); optic.rotation.x = Math.PI/2;
      mesh(new THREE.SphereGeometry(.027, 12, 12), cyan, -.025, .022, .092, lens);
    }
    mesh(new THREE.BoxGeometry(.05,.29,.025), cyan, 0, 1.03, .626);
    for(let i=0;i<5;i++) mesh(new THREE.BoxGeometry(.25,.014,.028), dark, 0, .7+i*.04, .616);
    for(const side of [-1,1]) {
      const tire=mesh(cylinder(.39,.23),rubber,side*.7,.38,0); tire.rotation.z=Math.PI/2;
      const hub=mesh(cylinder(.27,.245),metal,side*.7,.38,0); hub.rotation.z=Math.PI/2;
      const ring=mesh(new THREE.TorusGeometry(.275,.012,8,48),cyan,side*.837,.38,0); ring.rotation.y=Math.PI/2;
      for(let i=0;i<24;i++) {
        const a=i*Math.PI/12;
        const tread=mesh(new THREE.BoxGeometry(.24,.03,.07), dark,side*.7,.38+Math.cos(a)*.388,Math.sin(a)*.388); tread.rotation.x=a;
      }
      mesh(new THREE.SphereGeometry(.14,20,20),dark,side*.65,1.28,0);
      const arm=mesh(new THREE.BoxGeometry(.16,.44,.19),metal,side*.79,1.06,.03); arm.rotation.z=side*.38;
      mesh(new THREE.SphereGeometry(.1,16,16),dark,side*.87,.82,.08);
      const forearm=mesh(new THREE.BoxGeometry(.12,.28,.15),metal,side*.84,.66,.19); forearm.rotation.x=-.5;
      for(const finger of [-1,1]) mesh(new THREE.BoxGeometry(.045,.14,.08),dark,side*.84+finger*.055,.47,.25);
    }
    const resize=()=>{ const {width,height}=container.getBoundingClientRect(); renderer.setSize(width,height); camera.aspect=width/height; camera.updateProjectionMatrix(); };
    const observer=new ResizeObserver(resize); observer.observe(container); resize();
    let frame=0; const clock=new THREE.Clock();
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    let visible=true; const visibility=()=>{visible=!document.hidden;}; document.addEventListener('visibilitychange',visibility);
    const animate=()=>{
      frame=requestAnimationFrame(animate);
      if(!visible) return;
      const t=clock.getElapsedTime();
      robot.rotation.y=media.matches?-.15:Math.sin(t*.35)*.12-.15;
      head.rotation.y=media.matches?0:Math.sin(t*(activeRef.current?.9:.25))*.25;
      renderer.render(scene,camera);
    }; animate();
    return ()=>{ cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange',visibility); scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();}); [metal,dark,rubber,glass,cyan].forEach(m=>m.dispose()); renderer.dispose(); container.replaceChildren(); };
  },[]);
  return <div ref={host} className="robot-render" aria-label="3D miniature robot with a panoramic camera ring">{failed&&<span className="robot-fallback">◉<small>Robot preview unavailable</small></span>}</div>;
}
