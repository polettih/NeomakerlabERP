"use client";
import { useId } from "react";

/**
 * Campo de tempo em horas + minutos. O valor continua sendo guardado como
 * decimal (ex.: "1.5" para 1h30) — o mesmo formato que a fórmula de
 * precificação já usa — só a forma de digitar muda, pra não precisar
 * calcular a fração de hora na cabeça.
 */
export function HoursMinutesInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (decimalHours: string) => void;
}) {
  const hoursId = useId();
  const minutesId = useId();
  const total = Math.max(0, Number(value) || 0);
  const hours = Math.floor(total);
  const minutes = Math.round((total - hours) * 60);

  function set(h: number, m: number) {
    const safeHours = Math.max(0, Math.floor(h) || 0);
    const safeMinutes = Math.min(59, Math.max(0, Math.floor(m) || 0));
    const decimal = safeHours + safeMinutes / 60;
    onChange(String(Math.round(decimal * 10000) / 10000));
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <div className="field" style={{ maxWidth: 90 }}>
        <label htmlFor={hoursId} style={{ fontSize: 12 }}>
          Horas
        </label>
        <input
          id={hoursId}
          className="input"
          type="number"
          min="0"
          step="1"
          value={hours}
          onChange={(e) => set(Number(e.target.value), minutes)}
        />
      </div>
      <div className="field" style={{ maxWidth: 90 }}>
        <label htmlFor={minutesId} style={{ fontSize: 12 }}>
          Minutos
        </label>
        <input
          id={minutesId}
          className="input"
          type="number"
          min="0"
          max="59"
          step="1"
          value={minutes}
          onChange={(e) => set(hours, Number(e.target.value))}
        />
      </div>
    </div>
  );
}
