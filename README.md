# frame2d

`frame2d` 是一个二维刚架线性静力有限元求解器，现已封装为 FastAPI 后端。接口接收节点、梁柱单元、约束、节点荷载和单元分布荷载，返回节点位移、节点反力、单元端力及沿单元采样的 `N/V/M` 数据，并生成剪力 `V`、弯矩 `M` 的 PNG 折线图。

## 功能

- 二维刚架单元，每节点自由度顺序为 `[u, v, phi]`
- 节点集中力、节点力矩
- 支座局部轴可按任意角度倾斜，支持斜向滚动支座
- 局部坐标系下线性变化的轴向/横向分布荷载
- 零位移及非零指定节点位移
- 全局刚度组装、边界条件处理、位移求解和支座反力
- 单元局部位移、端力以及 `N/V/M` 场恢复
- 全局残差、刚度对称性和单元平衡检查
- `V`、`M` 折线图，可作为 Base64 data URI 返回，也可直接返回 PNG
- 自动生成 Swagger UI 和 OpenAPI 文档
- 使用 SQLite 持久化保存最近的模型历史

## 安装

需要 Python 3.11 或更高版本。

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[test]"
npm --prefix frontend install
```

## 同时启动前端与后端

在项目根目录执行：

```bash
npm run dev
```

这个命令会同时启动 FastAPI 和 Vite；在终端按 `Ctrl+C` 会同时关闭两项服务。

- 前端：<http://127.0.0.1:5173>
- Swagger UI：<http://127.0.0.1:8000/docs>
- 健康检查：<http://127.0.0.1:8000/health>

模型历史默认保存在 `data/frame2d.sqlite3`。可通过环境变量覆盖路径：

```bash
FRAME2D_DB_PATH=/path/to/frame2d.sqlite3 npm run dev
```

如需使用其他端口：

```bash
FRAME2D_API_PORT=8100 FRAME2D_FRONTEND_PORT=5174 npm run dev
```

前端始终支持热更新。如需同时监听 Python 后端代码变化，可执行：

```bash
FRAME2D_API_RELOAD=1 npm run dev
```

## 单独启动后端

开发模式：

```bash
uvicorn frame2d.api:app --host 0.0.0.0 --port 8000 --reload
```

也可以使用安装后的命令：

```bash
frame2d-api
```

单独启动后可访问：

- Swagger UI：<http://127.0.0.1:8000/docs>
- OpenAPI JSON：<http://127.0.0.1:8000/openapi.json>
- 健康检查：<http://127.0.0.1:8000/health>

## API

| 方法 | 路径 | 返回内容 |
| --- | --- | --- |
| `GET` | `/health` | 服务健康状态 |
| `POST` | `/api/v1/solve` | 数值结果；可选内嵌 V、M PNG |
| `POST` | `/api/v1/plots/shear-force` | 剪力 V 折线图，`image/png` |
| `POST` | `/api/v1/plots/bending-moment` | 弯矩 M 折线图，`image/png` |
| `GET` | `/api/v1/models` | 读取 SQLite 中的最近模型 |
| `POST` | `/api/v1/models` | 保存模型到 SQLite |
| `DELETE` | `/api/v1/models/{id}` | 删除历史模型 |

### 运行示例

仓库提供了悬臂梁示例请求 [examples/cantilever_request.json](examples/cantilever_request.json)。

求解并保存 JSON：

```bash
curl -X POST http://127.0.0.1:8000/api/v1/solve \
  -H "Content-Type: application/json" \
  --data-binary @examples/cantilever_request.json \
  --output result.json
```

直接生成剪力图和弯矩图：

```bash
curl -X POST http://127.0.0.1:8000/api/v1/plots/shear-force \
  -H "Content-Type: application/json" \
  --data-binary @examples/cantilever_request.json \
  --output shear_force_v.png

curl -X POST http://127.0.0.1:8000/api/v1/plots/bending-moment \
  -H "Content-Type: application/json" \
  --data-binary @examples/cantilever_request.json \
  --output bending_moment_m.png
```

### 请求字段

顶层请求格式：

```json
{
  "nodes": [{"id": 1, "x": 0.0, "y": 0.0}],
  "elements": [],
  "supports": [],
  "nodal_loads": [],
  "distributed_loads": [],
  "number_of_points": 101,
  "deformation_scale": 1.0,
  "include_plots": true,
  "plot_dpi": 140
}
```

- `nodes`：节点坐标；节点编号必须唯一且从 `1` 连续编号。
- `elements`：`node_i` 到 `node_j` 定义单元局部 `+x` 方向；`E/A/I` 必须为正数。
- `supports`：`u/v/phi` 为支座局部轴约束标志；`angle` 为局部 `+u` 轴相对全局 `+X` 的逆时针角度（度，默认 `0`），对应的 `*_value` 可指定局部非零位移。
- `nodal_loads`：全局坐标系中的 `fx/fy/mz`。
- `distributed_loads`：局部坐标系中的 `qx_i/qy_i/qx_j/qy_j`；同一单元的多条荷载会叠加。
- `number_of_points`：每个单元的场结果采样点数，范围 `2..2001`。
- `deformation_scale`：变形后坐标的显示比例，只影响 `x_deformed/y_deformed`。
- `include_plots`：是否在 `/solve` JSON 中嵌入两张 PNG；不需要图像时建议设为 `false`。
- `plot_dpi`：PNG 分辨率，范围 `72..300`。

### 求解结果

`/api/v1/solve` 的主要结果包括：

- `nodal_displacements`：每节点的 `u/v/phi`。
- `nodal_reactions`：完整全局残差向量按节点整理为 `fx/fy/mz`；倾斜支座处的全局 X/Y 反力可同时非零。
- `free_dofs`、`restrained_dofs`：从零开始的自由度位置；倾斜支座节点的平移位置代表支座局部 `u'/v'` 方向。
- `elements[].local_end_forces`：顺序为 `[fx_i, fy_i, m_i, fx_j, fy_j, m_j]`。
- `elements[].fields`：沿单元局部坐标采样的位移、变形坐标、轴力 `N`、剪力 `V` 和弯矩 `M`。
- `validation`：全局刚度对称性和支座局部自由方向残差校验。
- `plots`：`include_plots=true` 时包含 `shear_force_v`、`bending_moment_m`；其中 `data_uri` 可直接赋给浏览器 `<img src="...">`。

无效引用、重复编号、零长度单元、冲突的指定位移或不稳定/奇异模型会返回 HTTP `422`，错误原因位于响应的 `detail` 字段。

## 单位和符号约定

所有输入和输出采用一致的 SI 单位：

- 长度、位移：`m`
- 转角：`rad`
- 弹性模量：`Pa = N/m²`
- 截面面积：`m²`
- 截面惯性矩：`m⁴`
- 集中力、轴力、剪力：`N`
- 力矩、弯矩：`N·m`
- 分布荷载：`N/m`

节点荷载正方向为全局 `+X/+Y`，正力矩为逆时针。分布荷载正方向沿单元局部 `+x/+y`。轴力 `N` 以受拉为正；剪力和弯矩遵循求解器的单元局部约定：`V(0)=fy_i`、`M(0)=-m_i`、`V(L)=-fy_j`、`M(L)=m_j`。

前端的 Load 工具可先选择 `Moment`，再直接点击 node 施加 `Mz`。Support 工具可输入支座角度；例如 `v=true, angle=30` 表示约束局部法向位移
`v'=-sin(30°)u+cos(30°)v`，而局部 `u'` 方向保持可滑动。

## 作为 Python 库使用

FastAPI 层调用的是公开的统一求解函数，也可以在 Python 中直接使用：

```python
from frame2d import FrameElement, NodalLoad, Node, Support, solve_frame

result = solve_frame(
    nodes=[Node(1, 0.0, 0.0), Node(2, 2.0, 0.0)],
    elements=[FrameElement(1, 1, 2, E=210e9, A=3e-3, I=8e-6)],
    supports=[Support(1, u=True, v=True, phi=True)],
    nodal_loads=[NodalLoad(2, fy=-10_000.0)],
)

print(result.nodal_displacements)
print(result.elements[0].fields.shear_force)
print(result.elements[0].fields.bending_moment)
```

## 测试

```bash
pytest
```

测试覆盖底层有限元计算、统一求解流程、V/M PNG 渲染、API 数值响应、直接图像响应以及不稳定模型的错误处理。
