# ONNX 模型文件

## 已下载模型

| 文件 | 大小 | 来源 |
|------|------|------|
| `real_esrgan_x2.onnx` | 67MB | [Jonny001/deepfake](https://huggingface.co/Jonny001/deepfake) |

## 模型规格

- **输入**: `input` — shape `[1, 3, H, W]`, float32, RGB channel order, normalized to [0, 1]
- **输出**: `output` — shape `[1, 3, 2H, 2W]`, float32, same channel order and range
- **放大倍率**: 2×

## 添加更多模型

将 ONNX 模型文件放入此目录，然后修改 `src/App.tsx` 中的 `MODEL_URL` 常量。

### 推荐模型来源

- HuggingFace: https://huggingface.co/Jonny001/deepfake (x2, x4)
- HuggingFace: https://huggingface.co/hugglyberry/upscale-and-refine-models (多种变体)
- Modelscope: https://www.modelscope.cn/models/cix/ai_model_hub_25_Q3 (x4)
