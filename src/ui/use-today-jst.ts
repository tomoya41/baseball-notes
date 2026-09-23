import { useEffect, useState } from "react";
import { dateInZone } from "../domain/analysis-query";

export function useTodayJst() {
  const [date, setDate] = useState(() => dateInZone(Date.now(), "Asia/Tokyo"));
  useEffect(() => {
    const timer = setInterval(() => setDate(dateInZone(Date.now(), "Asia/Tokyo")), 60_000);
    return () => clearInterval(timer);
  }, []);
  return date;
}
