# Frame Studio frontend

這個目錄是獨立的 React + TypeScript + Vite 前端。求解器與 FastAPI 實作保留在專案根目錄的 `src/frame2d/`；前端不匯入任何 Python 模組，只透過 HTTP API 溝通。

## 開發

建議直接在專案根目錄同時啟動前後端：

```bash
npm run dev
```

此命令會統一管理兩個服務；按 `Ctrl+C` 時也會一起關閉。若只需單獨啟動前端，則在本目錄執行：

```bash
npm run dev
```

Vite 會把 `/api` 與 `/health` 代理到 `http://127.0.0.1:8000`。部署時可用 `VITE_API_BASE_URL` 指定 API origin。

## 分層

- `src/domain/`：前端資料模型、匯入與 API payload 轉換
- `src/api/`：後端 request/response contract 與 HTTP adapter
- `src/state/`：純前端模型更新邏輯
- `src/components/`：工具列、SVG 畫布、屬性與結果面板
- `src/data/`：前端示範模型

Save 產生的 JSON 與根目錄 README 中的 `/api/v1/solve` request 格式相容，可直接用於 API 或再次 Open。

## 前端工作區

- UI 使用 **Material UI v7**（`@mui/material` + Emotion + Roboto + `@mui/icons-material`）。
- 左側工具列依建模流程排列：Node → Material → Section → Element → Support → Load；Models 管理範例與歷史。
- **Guidance**：首次開啟會顯示 Getting started Dialog（Stepper）；工具列有 Guide / 提示開關；工作流 Stepper 可跳到對應工具；按 `?` 可重開指南。
- 材料與截面是前端資源庫，可指派給單一構件或全部構件；送出分析前才解析成後端所需的 `E/A/I`。
- 新構件預設不帶材料與截面；分析或儲存時若缺少必要指派，介面會導向相應資源庫。
- Results 有 compact 與 expanded 兩種高度；結構式 `N/V/M` 圖只在 expanded 模式顯示。
- Saved models 與最近分析由後端保存到 MySQL；舊版 `localStorage` 歷史會在首次載入時自動遷移。
