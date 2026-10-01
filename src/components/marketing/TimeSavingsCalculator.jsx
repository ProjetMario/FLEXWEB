import { Calculator } from "lucide-react";
import { useMemo, useState } from "react";

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function TimeSavingsCalculator() {
  const [tasks, setTasks] = useState(25);
  const [minutes, setMinutes] = useState(12);
  const [rate, setRate] = useState(45);
  const [automation, setAutomation] = useState(55);
  const result = useMemo(() => {
    const weeklyHours = Math.max(0, tasks * minutes / 60);
    const savedHours = weeklyHours * Math.max(0, Math.min(90, automation)) / 100;
    return {
      weeklyHours,
      savedHours,
      monthlyHours: savedHours * 4.33,
      monthlyValue: savedHours * 4.33 * rate,
    };
  }, [tasks, minutes, rate, automation]);
  return (
    <div className="tool-panel" data-conversion-scope="time-calculator">
      <div className="tool-header">
        <Calculator aria-hidden="true" />
        <div>
          <p>Calculateur</p>
          <h2>Estimer le temps économisé</h2>
        </div>
      </div>
      <div className="tool-grid">
        <label>Occurrences par semaine<input type="number" min="1" max="500" value={tasks} onChange={(e) => setTasks(Number(e.target.value) || 0)} /></label>
        <label>Minutes par occurrence<input type="number" min="1" max="240" value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 0)} /></label>
        <label>Coût horaire estimé<input type="number" min="0" max="300" value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} /></label>
        <label>Part automatisable<input type="range" min="10" max="90" step="5" value={automation} onChange={(e) => setAutomation(Number(e.target.value))} /><span>{automation} %</span></label>
      </div>
      <div className="result-grid" aria-live="polite">
        <strong>{result.weeklyHours.toFixed(1)} h</strong><span>répétées chaque semaine</span>
        <strong>{result.monthlyHours.toFixed(1)} h</strong><span>potentiellement économisées par mois</span>
        <strong>{euro.format(result.monthlyValue)}</strong><span>valeur indicative mensuelle</span>
      </div>
      <p className="tool-note">Hypothèse volontairement prudente : le résultat n’est pas un gain garanti. Il sert à décider si une tâche mérite un cadrage.</p>
    </div>
  );
}

