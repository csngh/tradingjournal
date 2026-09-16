export type FuturesSymbol = {
  symbol: string;
  name: string;
  pointValue: number;
};

export const FUTURES_SYMBOLS: FuturesSymbol[] = [
  { symbol: "ES", name: "E-mini S&P 500", pointValue: 50 },
  { symbol: "MES", name: "Micro E-mini S&P 500", pointValue: 5 },
  { symbol: "NQ", name: "E-mini Nasdaq 100", pointValue: 20 },
  { symbol: "MNQ", name: "Micro E-mini Nasdaq 100", pointValue: 2 },
  { symbol: "YM", name: "E-mini Dow", pointValue: 5 },
  { symbol: "MYM", name: "Micro E-mini Dow", pointValue: 0.5 },
  { symbol: "RTY", name: "E-mini Russell 2000", pointValue: 50 },
  { symbol: "M2K", name: "Micro E-mini Russell 2000", pointValue: 5 },
  { symbol: "CL", name: "Crude Oil", pointValue: 1000 },
  { symbol: "MCL", name: "Micro Crude Oil", pointValue: 100 },
  { symbol: "GC", name: "Gold", pointValue: 100 },
  { symbol: "MGC", name: "Micro Gold", pointValue: 10 },
  { symbol: "SI", name: "Silver", pointValue: 5000 },
  { symbol: "NG", name: "Natural Gas", pointValue: 10000 },
  { symbol: "ZB", name: "30Y T-Bond", pointValue: 1000 },
  { symbol: "ZN", name: "10Y T-Note", pointValue: 1000 },
  { symbol: "ZC", name: "Corn", pointValue: 50 },
  { symbol: "ZS", name: "Soybeans", pointValue: 50 },
  { symbol: "6E", name: "Euro FX", pointValue: 125000 },
  { symbol: "6B", name: "British Pound", pointValue: 62500 },
];

export function findFuturesSymbol(symbol: string): FuturesSymbol | undefined {
  return FUTURES_SYMBOLS.find((s) => s.symbol === symbol.toUpperCase());
}
