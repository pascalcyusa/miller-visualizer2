import { useState, useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

interface ParseResponse {
  type: "plane" | "direction";
  indices: number[];
  intercept?: number[];
}

export default function Home() {
  const [input, setInput] = useState<string>("");
  const mountRef = useRef<HTMLDivElement | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth * 0.8 / (window.innerHeight * 0.8),
      0.1,
      1000
    );
    camera.position.set(2, 2, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current?.clientWidth || 800, mountRef.current?.clientHeight || 600);
    if (mountRef.current) mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    // Add coordinate axes
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // Add grid
    const gridHelper = new THREE.GridHelper(10, 10);
    gridHelper.rotation.x = Math.PI / 2; // Rotate to XY plane
    scene.add(gridHelper);

    // Add coordinate labels
    const addCoordinateLabel = (position: THREE.Vector3, text: string) => {
      const div = document.createElement('div');
      div.className = 'coordinate-label';
      div.textContent = text;
      div.style.color = 'white';
      div.style.position = 'absolute';
      scene.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.TextureLoader().load('') })));
    };

    addCoordinateLabel(new THREE.Vector3(5.2, 0, 0), 'X');
    addCoordinateLabel(new THREE.Vector3(0, 5.2, 0), 'Y');
    addCoordinateLabel(new THREE.Vector3(0, 0, 5.2), 'Z');

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const cube = new THREE.LineSegments(edges, lineMaterial);
    cube.position.set(0.5, 0.5, 0.5);
    scene.add(cube);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const width = mountRef.current?.clientWidth || 800;
      const height = mountRef.current?.clientHeight || 600;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  const addVisualization = (data: ParseResponse) => {
    const scene = sceneRef.current;
    if (!scene) return;

    scene.children = scene.children.filter(
      (obj) => obj.type === "LineSegments"
    );

    if (data.type === "plane" && data.intercept) {
      const planeSize = 2;
      const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
      const planeMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        side: THREE.DoubleSide,
        opacity: 0.5,
        transparent: true,
      });
      const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);

      const normal = new THREE.Vector3(...data.indices).normalize();
      const defaultNormal = new THREE.Vector3(0, 0, 1);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        defaultNormal,
        normal
      );
      planeMesh.setRotationFromQuaternion(quaternion);
      if (data.intercept) {
        planeMesh.position.set(...data.intercept as [number, number, number]);
      }
      scene.add(planeMesh);
    } else if (data.type === "direction") {
      const dir = new THREE.Vector3(...data.indices).normalize();
      const origin = new THREE.Vector3(0.5, 0.5, 0.5);
      const length = 1;
      const arrowHelper = new THREE.ArrowHelper(dir, origin, length, 0x00ff00);
      scene.add(arrowHelper);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:8081/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      if (!res.ok) {
        alert("Error parsing input");
        return;
      }
      const data: ParseResponse = await res.json();
      addVisualization(data);
    } catch (error) {
      console.error("Fetch error:", error);
      alert("Error connecting to backend.");
    }
  };

  return (
    <div className="container">
      <div className="input-container">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full p-2 bg-gray-800 text-white rounded"
            placeholder="Enter plane (hkl) or direction [uvw]..."
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Visualize
          </button>
        </form>
      </div>
      <div ref={mountRef} className="viewport" />
    </div>
  );
}
