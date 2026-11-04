import * as THREE from 'three';
import { makeRegions } from './pure/regions.js';

// The third-person camera over my shoulder: it slides in along its arm instead of passing through furniture and
// stays inside the room I am standing in.
export function makeFollowCam(col, regions) {
  const rooms = makeRegions(regions);
  return function followPose(pos, yaw, pitch, dist, crouchK) {
    const l = pos.clone().add(new THREE.Vector3(0, 1.45 - crouchK * 0.4, 0));
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    l.add(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(-0.32));
    const p = l.clone().add(dir.clone().multiplyScalar(col.cameraRoom(l, dir, dist)));
    rooms.clamp(rooms.at(pos.x, -pos.z), p, pos.y);
    return { p, l };
  };
}
