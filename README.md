# Data Viewer

在 VS Code 中浏览、搜索并用 DuckDB SQL 查询工作区内的数据文件。侧边栏列出数据文件与 SQL 片段，点击数据文件后在单 tab Webview 中编辑 SQL 并查看分页表格。

## 功能

- **Data Files 侧边栏**：扫描当前工作区，支持搜索过滤
- **SQL Files 子树**：持久化 SQL 片段存于 `.dataviewer/queries/*.sql`，用原生编辑器编辑
- **多格式支持**：Parquet、CSV、TSV、JSON、JSONL、NDJSON、XLSX
- **XLSX 多 Sheet**：展开工作簿，按 Sheet 打开
- **DuckDB 查询**：扩展进程内嵌 `@duckdb/node-api`，大文件通过 `LIMIT` / `OFFSET` 分页
- **单 tab 数据查看器**：上方 CodeMirror SQL 编辑器（支持补全），下方分页表格，中间可拖拽分隔
- **SQL 补全**：DuckDB 关键字、函数及列名（CodeMirror 内嵌编辑器 + 原生 SQL 片段编辑器）
- **运行方式**：数据文件 tab 内 **Ctrl+Enter** / **Cmd+Enter**；SQL 片段在原生编辑器中 **Run Statement** CodeLens 或 **Ctrl+Enter**

## 支持的文件扩展名

| 扩展名 | 说明 |
|--------|------|
| `.parquet` | Parquet |
| `.csv` / `.tsv` | 分隔文本 |
| `.json` | JSON |
| `.jsonl` / `.ndjson` | 行式 JSON |
| `.xlsx` | Excel（按 Sheet 打开） |

可通过设置 `dataViewer.supportedExtensions` 自定义。

## 快速开始

### 环境要求

- Node.js 18+
- VS Code 1.85+

### 安装依赖并构建

```bash
npm install
npm run build
```

### 调试扩展

1. 在 VS Code 中打开本仓库
2. 按 **F5**（或运行 **Run Extension** 启动配置）
3. Extension Development Host 会自动打开本仓库作为工作区
4. 在活动栏打开 **Data Viewer** → **Data Files**
5. 点击 `sample-data/` 下的示例文件（如 `people.csv`）

开发时可用 **Run Extension (watch)**，配合 `npm run dev` 热重建。

### 运行测试

```bash
npm test
```

集成测试会校验 DuckDB 读写、分页与 XLSX Sheet 逻辑。

## 使用说明

1. **打开文件夹**：扩展需要已打开的工作区才能扫描文件；若列表为空，请 **File → Open Folder** 并点击侧边栏 **Refresh**。
2. **浏览与搜索**：在 Data Files 顶部的搜索框中按文件名或路径过滤。
3. **打开数据文件**：点击列表中的文件；XLSX 先展开再选择 Sheet。打开后为单 tab：上方 SQL 编辑器，下方结果表格。
4. **编辑与运行 SQL**：在 CodeMirror 编辑器中修改默认查询（如 `SELECT * FROM read_csv_auto('...')`），按 **Ctrl+Enter**（macOS：**Cmd+Enter**）或点击 **Run** 执行。
5. **SQL 片段**：在侧边栏 **SQL Files** 段点击 **+** 创建片段，在原生 SQL 编辑器中编辑；**Run Statement** CodeLens 或 **Ctrl+Enter** 在新 tab 打开同样的编辑器+表格布局查看结果。
6. **查看结果**：表格支持分页（默认每页 500 行）、排序与列过滤。

## 配置

| 设置 | 默认值 | 说明 |
|------|--------|------|
| `dataViewer.pageSize` | `500` | 表格每页行数（对应 SQL `LIMIT`） |
| `dataViewer.excludeGlobs` | `**/.git/**` 等 | 扫描时排除的 glob |
| `dataViewer.supportedExtensions` | 见上表 | 侧边栏显示的扩展名 |

## 命令

| 命令 | 说明 |
|------|------|
| `Data Viewer: Refresh` | 重新扫描工作区数据文件与 SQL 片段 |
| `Data Viewer: Open Data File` | 打开指定数据目标（由侧边栏调用） |
| `Data Viewer: New SQL Query` | 在 `.dataviewer/queries/` 创建新 SQL 片段 |
| `Data Viewer: Open SQL Query` | 打开 SQL 片段文件 |
| `Data Viewer: Run SQL Query` | 运行当前 SQL 片段全文（结果 tab） |
| `Data Viewer: Run SQL Statement` | 运行单条 SQL（CodeLens，结果 tab） |

## 项目结构

```
src/                    # 扩展主进程（TypeScript）
  duckdb/               # DuckDB 服务、查询构建、补全目录
  sql/                  # SQL 片段存储
  tree/                 # 侧边栏文件扫描与 Webview 提供程序
  viewer/               # 数据查看器、CodeLens、补全
  utils/                # 路径、XLSX、SQL 语句解析
webview/                # 数据查看器 React Webview（CodeMirror + 表格）
webview-explorer/       # Data Files 侧边栏 React Webview
sample-data/            # 示例数据
scripts/                # 集成测试
dist/                   # 构建输出（git 忽略）
```

构建由 Vite 驱动：`vite.config.extension.ts` 打包扩展，`vite.config.webview.ts` 打包两个 Webview 入口。

## 技术栈

- **扩展**：TypeScript、VS Code Extension API
- **查询引擎**：[@duckdb/node-api](https://www.npmjs.com/package/@duckdb/node-api)
- **Webview UI**：React 19、TanStack Table 8、CodeMirror 6
- **构建**：Vite 8

## 许可证

MIT（如未另行声明，以仓库为准）
