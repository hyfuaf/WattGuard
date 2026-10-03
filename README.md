# 家庭用电网站

这是可运行的 Web 应用：账户登录、家电绑定、按插座 ID 上传 HTTP 功率数据、实时页面更新、历史用电记录、统计报告、模拟订阅、可选千问 AI 报告和建议状态均由后端提供。

## Cloudflare 公网部署

线上版本使用 Cloudflare Workers 托管前端和 API，D1 保存账户与用电数据。先安装依赖，然后执行数据库迁移和部署：

```sh
npm install
npm run db:cf
npm run deploy:cf
```

`wrangler.toml` 已绑定 `wattguard-db`。线上页面每 30 秒同步一次用电状态；设备上传后新数据会进入 D1。部署使用 Cloudflare 分配的 `*.workers.dev` HTTPS 地址，具体地址以 `wrangler deploy` 输出为准。

千问是可选配置。需要启用时，给 Cloudflare Worker 设置 `QWEN_API_KEY` Secret，并在网站设置页开启模拟订阅和允许 AI 分析。模型名由 `wrangler.toml` 中的 `QWEN_MODEL` 指定，默认 `qwen-plus`。模拟订阅不涉及支付，但服务端只允许已订阅账户生成千问报告。未配置 Key 时统计报告照常工作，千问报告不可用。报告中的同类比较由模型作有条件的定性分析；未接入可靠基准时不会给出虚构的平均值或排名。

## 运行

需要 Node.js 24 或更高版本，无需安装第三方依赖。

```sh
npm start
```

默认访问 http://127.0.0.1:4310 。首次打开创建账户；不会自动创建演示用户或示例读数。

```sh
npm test
```

集成测试使用独立临时数据库，验证账户隔离、上传校验、电量计算、解绑、报告快照和服务重启后的持久化。

数据保存在 `data/energy.sqlite`。备份时先停止服务，或使用 SQLite 的在线备份工具，避免只复制仍在写入的主数据库。

## HTTP 硬件接入

网页绑定插座时填写机身 ID、类型、别名和房间。硬件上传时只需发送同一个插座 ID，不使用设备密钥。

```http
POST /api/telemetry
Content-Type: application/json

{
  "deviceId": "SP-00134",
  "timestamp": "2026-10-03T13:00:00.000Z",
  "powerWatts": 980,
  "energyKwh": 123.456
}
```

将示例时间换成实际采样时间。`timestamp` 支持含时区的 ISO 时间或 Unix 毫秒时间，最大允许提前 60 秒，支持 90 天内补传；不得早于当前家电绑定时间。`powerWatts` 为必填非负功率，`energyKwh` 为可选的硬件累计读数，单位 kWh。

推荐每 10–60 秒上传。相同设备与时间戳的重复请求幂等，数值冲突返回 409。成功返回 `{"ok":true,"receivedAt":"..."}`；未绑定的插座 ID 返回 404。

解绑后该插座 ID 停止接收上传；相同插座可在原账户重新绑定，新电器不会继承旧电器的用电记录。历史记录仍可导出。

当前接口仅凭插座 ID 识别上传来源。知道某个已绑定 ID 的人可能伪造读数，请勿公开真实 ID。量产硬件仍需设计可信的设备身份机制，以防止抢先登记或伪造上传。

## 电量计算

- 两个相邻累计读数有效且未回退时，使用差值；跨报告边界按时长分摊，属于估算。
- 没有可用累计差值时，以梯形法积分相邻功率采样，间隔超过 5 分钟的区间跳过。
- 不将末次读数外推到现在；仅一个读数时，电量显示不足，而不是零。
- 累计计量跨断线可计算用电量，但采样覆盖率仍反映功率时序缺失。
- 费用使用家庭设置中的单一电价，不等同于供电公司的分时或阶梯账单。
- 报告保留生成时快照；补传后需要重新生成报告。

## 真实 AI 服务

千问请求集中在 [`src/qwen.js`](src/qwen.js)，使用阿里云百炼的 OpenAI 兼容 Chat Completions 接口。服务端读取 `QWEN_API_KEY` 与 `QWEN_MODEL`；网页不接收 API Key。其他平台的登录状态或 API Key 不能代替百炼 API Key。

本地 Node 服务：将 `.env.example` 复制为 `.env`，把 `YOUR_QWEN_API_KEY` 换成自己的百炼 Key，然后运行 `npm start`。`.env` 已被 Git 忽略。

本地 Cloudflare Worker：将 `.dev.vars.example` 复制为 `.dev.vars`，填入自己的 Key，再运行 `npm run dev:cf`。`.dev.vars` 已被 Git 忽略。

线上 Cloudflare Worker：在仓库目录执行以下命令，按提示输入 Key，随后部署。`QWEN_MODEL` 已写在 `wrangler.toml` 中。不要把 Key 写进该文件或提交到 GitHub。

```sh
npx wrangler secret put QWEN_API_KEY
npm run deploy:cf
```

在网页“家庭与设置”中开启模拟订阅并授权后，千问报告会调用百炼接口；电器候选识别仅需要授权。请求仅发送去标识化统计摘要或功率时序，不发送邮箱、家庭名称、插座 ID。AI 服务密钥只留在服务端。

未配置或未授权时，统计与规则报告可用；不会把规则输出伪装成 AI。首次识别至少需要 6 条读数，电器类型最终仍由用户确认。真实模型调用需在配置有效 API Key 后验证。

接口参考：https://help.aliyun.com/zh/model-studio/compatibility-mode

## 同类电器基准

不内置虚构基准。通过 `BENCHMARK_FILE` 指定由可靠授权来源得到的 JSON 文件：

```json
[
  {
    "type": "空调",
    "spec": "与用户填写完全一致的规格",
    "dailyKwh": 0.001,
    "sampleSize": 128,
    "source": "填写真实来源及统计日期，数值必须替换",
    "conditions": "填写地域、气候、运行时长、容量、能效等匹配限制"
  }
]
```

以上仅展示格式，不是可采用的基准数据。网站要求类型与规格完全匹配、至少 3 天有效观察、采样覆盖率不低于 80%，并显示来源、条件和样本量。其他使用条件仍需人工核查，不能直接把差异解释成效率或故障。

## 部署与配置

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `PORT` | `4310` | 服务端口 |
| `HOST` | `127.0.0.1` | 监听地址；局域网可设 `0.0.0.0` |
| `DB_PATH` | `data/energy.sqlite` | 数据库路径 |
| `QWEN_API_KEY` | 无 | 阿里云百炼 API Key，仅服务端使用 |
| `QWEN_MODEL` | `qwen-plus`（Cloudflare） | 千问模型名称，须由 API 账户支持 |
| `BENCHMARK_FILE` | 无 | 真实同类基准文件路径 |
| `SECURE_COOKIE` | 无 | HTTPS 部署时设 `1` |

本地地址只在当前电脑可访问。硬件需要可达的局域网地址，或部署到 HTTPS 公网服务；反向代理需保留 Host，允许 SSE，关闭 SSE 缓冲，并将超时设为至少 90 秒。公网运行时启用 HTTPS 与 `SECURE_COOKIE=1`。

数据库写入和密码散列在当前单进程服务内完成，适合本地或小规模验证。量产前需补充工厂设备身份、邮箱验证、找回密码、运维备份、密钥管理、容量测试以及经验证的同类基准服务。
