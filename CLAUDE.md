# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

纯前端的 AI 图片无损放大工具。基于 Real-ESRGAN 模型，通过 ONNX Runtime Web 在浏览器本地完成推理，无需后端服务。

## 技术栈

- React 18 + TypeScript + Vite
- TailwindCSS v4（`@tailwindcss/vite` 插件方式）
- onnxruntime-web（WebGPU 优先，WebAssembly 降级）
- react-dropzone（拖拽上传）

## 常用命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建（先 tsc 类型检查，再 vite build）
npm run preview      # 预览生产构建
npx tsc --noEmit     # 仅类型检查
```

## 架构

### 数据流

```
File → <img> → Canvas → ImageData → Float32Array
  → Web Worker (ONNX InferenceSession.run, 逐块推理)
  → Float32Array → ImageData → Canvas → Blob → Download
```

### Web Worker 推理

ONNX 推理放在 `src/workers/inference.worker.ts` 的 Web Worker 中，避免阻塞主线程。Worker 通过 `postMessage` + Transferable ArrayBuffer 与主线程通信，tensor 数据零拷贝传递。

模型加载在 Worker 中完成，一次加载后可复用多次推理。

### 大图分块策略 (`src/lib/tiling.ts`)

将大图切成 `tileSize`（默认 256px）的方块，带 `overlap`（默认 32px）用于融合。每块独立送入 ONNX 推理，结果直接绘制到输出 Canvas 对应位置。overlap 区域用线性渐变的 alpha 蒙版混合消除拼接痕迹。

### 预处理/后处理

- **preprocessing.ts**: HTMLImageElement → Float32Array tensor（CHW 布局，归一化到 [0,1]），同时做 reflect-pad 填充使尺寸对齐 tile 倍数
- **postprocessing.ts**: 模型输出 tensor（CHW，[0,1]）→ ImageData → Canvas → Blob

### 关键配置

- **COOP/COEP Headers**: `vite.config.ts` 中设置了 `Cross-Origin-Opener-Policy: same-origin` 和 `Cross-Origin-Embedder-Policy: require-corp`，这是 ONNX Runtime WebGPU 后端使用 `SharedArrayBuffer` 的前提
- **模型**: `public/models/real_esrgan_x2.onnx`（67MB，来自 HuggingFace Jonny001/deepfake），输入 `[1,3,H,W]` float32 → 输出 `[1,3,2H,2W]` float32，2× 放大
- **模型放置**: ONNX 模型文件放入 `public/models/` 目录，构建时会被复制到 `dist/`

### Vite 限制

由于项目目录名含中文（IMAGE放大），`npm init` 需用 `--name` 指定英文包名；`vite build` 无此限制。

### 浏览器要求

- Chrome/Edge 113+（需 WebGPU 支持，访问 `chrome://gpu` 确认）
- Safari/Firefox 降级到 WebAssembly 后端（较慢）
- 首次加载需下载 69MB 模型文件（浏览器 HTTP 缓存后续复用）
