import report from './report.js';

export function fetchGrade(name) {
  report(name);
  switch (name) {
    case 'Jerry':
      return 699;
    case 'Tom':
      return 250;
    default:
      return 0;
  }
}
