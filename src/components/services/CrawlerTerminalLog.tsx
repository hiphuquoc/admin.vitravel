'use client';

import React, { useEffect, useRef } from 'react';

interface CrawlerTerminalLogProps {
  logs: string[];
  running?: boolean;
  maxHeight?: string;
  className?: string;
}

function formatLogLine(raw: string): { time?: string; content: React.ReactNode; tone: string } {
  let line = raw.trim();
  let time: string | undefined;

  const timeMatch = line.match(/^\[(\d{1,2}:\d{2}:\d{2}(?:\s?[AP]M)?)\]\s*(.*)$/i);
  if (timeMatch) {
    time = timeMatch[1];
    line = timeMatch[2];
  }

  let tone = 'default';
  if (/^(✓|\[done\]|hoàn tất|thành công|đã tạo|success)/i.test(line) || line.includes("✓")) {
    tone = 'success';
  } else if (/^(✗|lỗi|error|failed|không kết nối|không thể|thất bại)/i.test(line) || line.includes("✗")) {
    tone = 'error';
  } else if (/^(⚠|đợi|warning|cảnh báo|bị chặn|blocked|busy)/i.test(line) || line.includes("⚠")) {
    tone = 'warn';
  } else if (/^(•|đang|bắt đầu|tiến hành|running|process|xử lý)/i.test(line) || line.includes("•")) {
    tone = 'brand';
  } else if (/(\[worker\]|chrome|import|map|queue)/i.test(line)) {
    tone = 'info';
  }

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = line.split(urlRegex);
  const matches: string[] = line.match(urlRegex) || [];

  return {
    time,
    content: (parts.length > 1 ? (
      <>
        {parts.map((part, index) => {
          if (matches.includes(part)) {
            return (
              <span key={index} className="ui-crawler-terminal__text--url">
                {part}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </>
    ) : line),
    tone,
  };
}

export function CrawlerTerminalLog({ logs, running = false, maxHeight, className = '' }: CrawlerTerminalLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className={`ui-crawler-terminal ${className}`} style={maxHeight ? { maxHeight } : undefined}>
      <div className="ui-crawler-terminal__bar">
        <div className="ui-crawler-terminal__dots">
          <span />
          <span />
          <span />
        </div>
        <span className="ui-crawler-terminal__label">
          {running ? 'Chrome Crawler Engine • Live Log' : 'Console Live Log'}
        </span>
        <span style={{ fontSize: '0.7rem', color: running ? 'var(--admin-primary-500)' : 'rgba(255,255,255,0.4)', fontWeight: 650 }}>
          {running ? 'ACTIVE' : 'IDLE'}
        </span>
      </div>

      <div className="ui-crawler-terminal__lines" ref={containerRef}>
        {logs.length === 0 ? (
          <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic', padding: '0.5rem 0' }}>
            Đang khởi động crawler engine…
          </div>
        ) : (
          logs.map((raw, idx) => {
            const { time, content, tone } = formatLogLine(raw);
            return (
              <div key={idx} className="ui-crawler-terminal__row">
                {time ? <span className="ui-crawler-terminal__time">{time}</span> : null}
                <div className={`ui-crawler-terminal__text ui-crawler-terminal__text--${tone}`}>
                  {content}
                  {running && idx === logs.length - 1 ? <span className="ui-crawler-terminal__cursor" /> : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
