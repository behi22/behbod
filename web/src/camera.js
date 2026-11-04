import * as THREE from 'three';

// The third-person camera over my shoulder: it slides in along its arm instead of passing through furniture and
// stays inside the world's bounds (given in Blender axes, where y becomes -z).
export function makeFollowCam(col, bounds) {
  return function followPose(pos, yaw, pitch, dist, crouchK) {
    const l = pos.clone().add(new THREE.Vector3(0, 1.45 - crouchK * 0.4, 0));
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    l.add(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(-0.32));
    const p = l.clone().add(dir.clone().multiplyScalar(col.cameraRoom(l, dir, dist)));
    p.x = Math.min(Math.max(p.x, bounds.min[0]), bounds.max[0]);
    p.z = Math.min(Math.max(p.z, -bounds.max[1]), -bounds.min[1]);
    p.y = Math.min(Math.max(p.y, pos.y + 0.4), bounds.top);
    return { p, l };
  };
}
