// Where the residents' new routines happen and the small rules inside them. Places are Blender axes (x east, y north,
// z up), in metres; "reach" spots are ones the 0.2 m walk grid can get to, and the last bit is a short straight walk.
// The cat tree stands in a pocket between the console shelf, the egg chair and the wall that the walk grid (sized for
// me) cannot enter. Pishi walks to `reach`, then straight through the gap beside the shelf to the tree's foot.
export const TREE = { reach: [1.1, 12.4, 0], gap: [1.05, 13.05, 0], foot: [1.12, 13.62, 0] };
export const inPocket = ([x, y, z]) => x < 1.32 && y > 12.75 && y < 13.95 && z < 0.3;
