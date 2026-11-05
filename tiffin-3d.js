import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const canvas = document.querySelector("#tiffin3d-canvas");
const stage = document.querySelector("#tiffin-animation");
const scrollSection = stage?.closest(".scroll-feature");
if (canvas && stage && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, stage.clientWidth / stage.clientHeight, 0.1, 60);
    camera.position.set(0, 3.5, 12.5);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8b967d, 2.3));
    const keyLight = new THREE.DirectionalLight(0xfff2dc, 3.2);
    keyLight.position.set(-3, 7, 5);
    scene.add(keyLight);
    const edgeLight = new THREE.DirectionalLight(0xd8e8ff, 2.4);
    edgeLight.position.set(4, 3, -4);
    scene.add(edgeLight);

    const steel = new THREE.MeshStandardMaterial({ color: 0xd8dfdc, metalness: 0.88, roughness: 0.2 });
    const brightSteel = new THREE.MeshStandardMaterial({ color: 0xf2f5f2, metalness: 0.92, roughness: 0.13 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x77827c, metalness: 0.9, roughness: 0.24 });
    const foodMat = (color, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, roughness });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc99c55, metalness: 0.68, roughness: 0.3 });
    const root = new THREE.Group();
    root.rotation.y = -0.2;
    scene.add(root);

    const cylinder = (radiusTop, radiusBottom, height, material, y, group = root, segments = 64) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
      mesh.position.y = y;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };
    const torus = (radius, tube, material, y, group = root) => {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 72), material);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = y;
      group.add(mesh);
      return mesh;
    };
    const sphere = (x, y, z, sx, sy, sz, material, group = root) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), material);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.rotation.y = Math.random() * Math.PI;
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };

    const compartments = [];
    const compartmentPhotoMeshes = [];
    const makeLayer = (y, kind) => {
      const group = new THREE.Group();
      group.position.y = y;
      root.add(group);
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.92, 0.36, 64, 1, true), steel);
      shell.castShadow = true;
      shell.receiveShadow = true;
      group.add(shell);
      cylinder(0.94, 0.94, 0.045, darkSteel, -0.16, group);
      torus(1.01, 0.045, brightSteel, 0.17, group);
      const foodGroup = new THREE.Group();
      group.add(foodGroup);
      if (kind === "dal") {
        cylinder(0.87, 0.87, 0.025, foodMat(0xd99a46), 0.19, foodGroup);
        for (let i = 0; i < 12; i++) {
          const a = i * Math.PI * 2 / 12;
          sphere(Math.cos(a) * 0.58, 0.23, Math.sin(a) * 0.58, 0.035, 0.02, 0.035, brass, foodGroup);
        }
      } else if (kind === "rice") {
        const rice = foodMat(0xfff9e7);
        for (let i = 0; i < 38; i++) {
          const a = i * 2.4;
          const r = 0.15 + (i % 5) * 0.13;
          sphere(Math.cos(a) * r, 0.22 + (i % 3) * 0.013, Math.sin(a) * r, 0.11, 0.035, 0.045, rice, foodGroup);
        }
      } else if (kind === "sabzi") {
        const colors = [0x758348, 0xc59b4d, 0x9e5940, 0x9da56c, 0xceb986];
        for (let i = 0; i < 20; i++) {
          const a = i * 2.4;
          const r = 0.12 + (i % 6) * 0.105;
          const size = 0.07 + (i % 3) * 0.025;
          sphere(Math.cos(a) * r, 0.22 + (i % 3) * 0.018, Math.sin(a) * r, size, size * 0.65, size * 1.15, foodMat(colors[i % colors.length]), foodGroup);
        }
      } else {
        for (let i = 0; i < 3; i++) {
          const roti = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.035, 48), foodMat(0xd6a45b));
          roti.position.set((i - 1) * 0.12, 0.22 + i * 0.035, 0.02);
          roti.rotation.y = i * 0.3;
          foodGroup.add(roti);
          sphere(roti.position.x + 0.11, roti.position.y + 0.02, -0.1, 0.08, 0.022, 0.06, foodMat(0x91603a), foodGroup);
        }
      }
      const photoMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
      const photoDisc = new THREE.Mesh(new THREE.CircleGeometry(0.78, 64), photoMaterial);
      photoDisc.rotation.x = -Math.PI / 2;
      photoDisc.position.y = 0.12;
      photoDisc.visible = false;
      photoDisc.userData.foodGroup = foodGroup;
      group.add(photoDisc);
      compartmentPhotoMeshes.push(photoDisc);
      compartments.push(group);
      return group;
    };

    makeLayer(-1.28, "roti");
    makeLayer(-0.77, "sabzi");
    makeLayer(-0.26, "rice");
    makeLayer(0.25, "dal");
    const lidPivot = new THREE.Group();
    lidPivot.position.set(-1.02, 0.56, 0);
    root.add(lidPivot);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.13, 64), steel);
    lid.position.x = 1.02;
    lid.castShadow = true;
    lidPivot.add(lid);
    const lidEdge = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.055, 12, 72), brightSteel);
    lidEdge.rotation.x = Math.PI / 2;
    lidEdge.position.set(1.02, -0.04, 0);
    lidPivot.add(lidEdge);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), brass);
    knob.scale.set(1.15, 0.55, 1.15);
    knob.position.set(1.02, 0.09, 0);
    lidPivot.add(knob);

    const loadCompartmentPhotos = async () => {
      const config = window.JFF_CONFIG || {};
      if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase?.createClient) return;
      const db = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      const keys = ["animation_roti_image", "animation_sabzi_image", "animation_rice_image", "animation_dal_image"];
      const { data, error } = await db.from("website_content").select("content_key,content_value").eq("business", "tiffin").in("content_key", keys);
      if (error) return;
      const textureLoader = new THREE.TextureLoader();
      (data || []).forEach((row) => {
        const index = keys.indexOf(row.content_key);
        if (index < 0 || !/^https?:\/\//i.test(row.content_value || "")) return;
        textureLoader.load(row.content_value, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          const imageWidth = texture.image?.naturalWidth || texture.image?.width || 1;
          const imageHeight = texture.image?.naturalHeight || texture.image?.height || 1;
          const aspect = imageWidth / imageHeight;
          if (aspect > 1) {
            texture.repeat.set(1 / aspect, 1);
            texture.offset.set((1 - 1 / aspect) / 2, 0);
          } else {
            texture.repeat.set(1, aspect);
            texture.offset.set(0, (1 - aspect) / 2);
          }
          texture.needsUpdate = true;
          const mesh = compartmentPhotoMeshes[index];
          mesh.material.map = texture;
          mesh.material.opacity = 1;
          mesh.material.needsUpdate = true;
          mesh.visible = true;
          mesh.userData.foodGroup.visible = false;
          renderer.render(scene, camera);
        });
      });
    };
    loadCompartmentPhotos();

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.45, 48), new THREE.MeshBasicMaterial({ color: 0x314539, transparent: true, opacity: 0.1 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.57;
    root.add(shadow);

    const resize = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    let lastSmooth = 0;
    const ease = (value) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
    const setProgress = () => {
      const rect = scrollSection.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -rect.top / Math.max(1, scrollSection.offsetHeight - window.innerHeight)));
      const smooth = progress * progress * (3 - 2 * progress);
      lastSmooth = smooth;
      const mobile = window.innerWidth < 620;
      const xTargets = mobile ? [-3.15, -1.05, 1.05, 3.15] : [-3.45, -1.15, 1.15, 3.45];
      const yTargets = [0, 0, 0, 0];
      const baseY = [-1.28, -0.77, -0.26, 0.25];
      const lidOpen = ease(smooth * 3.3);
      const lidTravel = ease((smooth - 0.16) * 1.75);
      const topDistance = mobile ? 29 : 14;
      camera.position.set(0, 3.5 + (topDistance - 3.5) * smooth, 12.5 * (1 - smooth) + 0.01 * smooth);
      camera.up.set(0, 1 - smooth, -smooth).normalize();
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      root.rotation.y = -0.2 * (1 - smooth);
      lidPivot.rotation.z = -lidOpen * 0.42 - lidTravel * 0.28;
      lidPivot.rotation.x = lidTravel * 0.22;
      lidPivot.position.set(-1.02, 0.56 + lidOpen * 0.38, lidTravel * 7.5);
      lidPivot.scale.setScalar(1 - lidTravel);
      compartments.forEach((item, index) => {
        const reveal = ease((smooth - 0.08 - index * 0.14) * 3.2);
        const travel = ease((smooth - 0.2 - index * 0.11) * 2.7);
        item.position.x = travel * xTargets[index];
        item.position.y = baseY[index] * (1 - travel) + reveal * 0.18 * (1 - travel) + travel * yTargets[index];
        item.position.z = travel * [0.02, -0.02, 0.02, -0.02][index];
        item.rotation.z = (index % 2 ? -1 : 1) * reveal * 0.045 * (1 - travel);
        item.rotation.y = travel * (index % 2 ? -0.03 : 0.03);
      });
      document.querySelectorAll("[data-scroll-step]").forEach((step) => {
        const index = Number(step.dataset.scrollStep);
        step.classList.toggle("is-active", smooth > index * 0.19 && smooth < Math.min(1, index * 0.19 + 0.32));
      });
      renderer.render(scene, camera);
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) renderer.render(scene, camera);
    }, { threshold: 0.02 });
    observer.observe(scrollSection);
    window.addEventListener("resize", () => { resize(); setProgress(); }, { passive: true });
    window.addEventListener("scroll", setProgress, { passive: true });
    resize();
    setProgress();
    renderer.render(scene, camera);
    stage.classList.add("has-3d");
  } catch (error) {
    console.warn("3D scene unavailable; showing the lightweight fallback.", error);
  }
}

