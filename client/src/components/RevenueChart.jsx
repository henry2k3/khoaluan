import { useEffect, useRef } from 'react';
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { formatMoney } from '../utils/display.js';

// Chỉ nạp phần biểu đồ cột cần dùng, không thêm React wrapper hoặc thư viện ngày.
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

export default function RevenueChart({ points, granularity }) {
  const canvas = useRef(null);
  useEffect(() => {
    const chart = new Chart(canvas.current, {
      type: 'bar',
      data: {
        labels: points.map(({ date }) =>
          granularity === 'hour'
            ? date.slice(11)
            : `${date.slice(8, 10)}/${date.slice(5, 7)}`,
        ),
        datasets: [
          {
            label: 'Doanh thu',
            data: points.map(({ revenue }) => revenue),
            backgroundColor: '#0d9488',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          tooltip: {
            callbacks: { label: (context) => formatMoney(context.parsed.y) },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 7, maxRotation: 0 },
          },
          y: {
            beginAtZero: true,
            ticks: {
              maxTicksLimit: 5,
              callback: (value) =>
                new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(
                  value,
                ),
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [points, granularity]);
  return (
    <div className="relative h-64 min-w-0 w-full sm:h-72">
      <canvas
        ref={canvas}
        role="img"
        aria-label="Biểu đồ doanh thu theo giờ Việt Nam"
        data-revenue-chart
      />
    </div>
  );
}
