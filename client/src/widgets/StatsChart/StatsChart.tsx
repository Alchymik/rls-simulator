import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from 'recharts';
import type { SessionResult } from '@/entities/session/types';
import styles from './StatsChart.module.css';

interface ChartPoint {
  /** Сквозной номер определения цели (от старых сеансов к новым) */
  idx: number;
  reaction: number;
  correct: boolean;
}

// Recharts передаёт в shape сам элемент данных в payload
const renderReactionBar = ({ x, y, width, height, payload }: BarShapeProps) => {
  const { correct } = payload as ChartPoint;
  return <rect x={x} y={y} width={width} height={height} fill={correct ? '#2e7d32' : '#c62828'} />;
};

/** График времени определения целей по сохранённым сеансам (п.3.3 ТЗ, п.7). */
export const StatsChart = ({ sessions }: { sessions: SessionResult[] }) => {
  // Сервер отдаёт сеансы от новых к старым: разворачиваем для хронологии и нумеруем
  // определения сквозным счётчиком, иначе точки разных сеансов ложатся на одну позицию
  const data: ChartPoint[] = [...sessions]
    .reverse()
    .flatMap((s) => s.points)
    .map((p, i) => ({
      idx: i + 1,
      reaction: +(p.reactionMs / 1000).toFixed(1),
      correct: p.correct,
    }));

  if (!data.length) {
    return <p className={styles.empty}>Нет отмеченных целей — график появится после первого сеанса.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#d9dee6" />
        <XAxis dataKey="idx" stroke="#5b6b7c" />
        <YAxis stroke="#5b6b7c" unit=" с" />
        <Tooltip
          contentStyle={{ background: '#eef1f5', border: '1px solid #d9dee6' }}
          formatter={(value) => [`${String(value)} с`, 'Время определения']}
          labelFormatter={(idx) => (typeof idx === 'number' ? `Определение №${idx}` : '')}
        />
        <Bar dataKey="reaction" shape={renderReactionBar} />
      </BarChart>
    </ResponsiveContainer>
  );
};
