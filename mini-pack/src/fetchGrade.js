export function fetchGrade(name) {
  switch (name) {
    case 'Jerry':
      return 99;
    case 'Tom':
      return 59;
    default:
      return 0;
  }
}
