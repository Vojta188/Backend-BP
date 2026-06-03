export function vypocitejObtiznost(procenta) {
if (procenta > 80) return "hard";
if (procenta < 40) return "easy";
return "medium";
}
