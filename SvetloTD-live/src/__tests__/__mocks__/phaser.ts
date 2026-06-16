// Phaser browser stub for Jest unit tests
const PhMath = {
  DegToRad: (d: number): number => (d * Math.PI) / 180,
  RadToDeg: (r: number): number => (r * 180) / Math.PI,
};
const Phaser = { Math: PhMath };
export default Phaser;
export { PhMath as Math };
