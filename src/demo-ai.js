const kwh = value => Number(value).toFixed(3);
const percent = value => Math.round(value * 100);

const context = {
  '空调': '空调用电受设定温度、天气、房间面积和运行时长影响较大。',
  '冰箱': '冰箱持续运行，用电受容量、环境温度和开门频率影响。',
  '洗衣机': '洗衣机用电与洗涤次数、程序和水温有关。',
  '电视': '电视用电与屏幕尺寸、亮度和观看时长有关。',
  '热水器': '热水器用电与用水量、设定温度及保温时长有关。',
  '路由器': '路由器通常持续运行，比较时应考虑实际在线时长。',
  '电脑': '电脑用电与负载、性能模式及使用时长有关。'
};

export function demoReport(snapshot) {
  const devices = [...snapshot.devices].sort((a, b) => (b.energy ?? -1) - (a.energy ?? -1));
  const measured = devices.filter(device => device.energy !== null);
  const total = snapshot.energy;
  const overview = `本周期已记录 ${kwh(total)} kWh，涉及 ${devices.length} 台已接入家电，采样覆盖率 ${percent(snapshot.coverage)}%。${measured.length ? `用电最多的是“${measured[0].alias}”，记录 ${kwh(measured[0].energy)} kWh${total > 0 ? `，占已记录总量的 ${percent(measured[0].energy / total)}%` : ''}。` : ''}${snapshot.coverage < .8 ? ' 数据缺口较大，以下结论只针对已采集的时段。' : ''}`;
  const comparison = devices.map(device => {
    const reading = device.energy === null ? '暂无足够连续读数，无法计算周期用电。' : `已记录 ${kwh(device.energy)} kWh，采样覆盖率 ${percent(device.coverage)}%，观察到的最高功率 ${device.peak === null ? '未知' : `${Math.round(device.peak)} W`}。`;
    if (device.baseline && device.energy !== null && device.baseline.periodKwh > 0) {
      const difference = (device.energy / device.baseline.periodKwh - 1) * 100;
      return `“${device.alias}”（${device.type}）：${reading} 与匹配条件下的周期基准 ${kwh(device.baseline.periodKwh)} kWh 相比，${difference >= 0 ? '高' : '低'} ${Math.abs(difference).toFixed(1)}%。来源：${device.baseline.source}；仍需核对使用条件。`;
    }
    return `“${device.alias}”（${device.type}）：${reading} ${context[device.type] || '实际耗电会随负载和使用时长变化。'}目前没有同口径的可靠平均值，不能判定高于或低于同类。`;
  }).join('\n');
  const advice = snapshot.suggestions.length
    ? snapshot.suggestions.map(item => `“${item.alias}”：${item.title}。${item.text} 依据：${item.basis}。`).join('\n')
    : '当前没有足够依据指出具体异常。可先保持连续采样，并核对高用电家电的实际使用时长；不要把未采集时段视为零用电。';
  return `用电概况\n${overview}\n\n同类用电比较\n${comparison}\n\n节电建议\n${advice}\n\n本报告为演示规则分析，未调用 AI 模型；不提供未经验证的同类平均值。`;
}

export function demoIdentification(stats) {
  const peak = stats.peak ?? 0;
  const mean = stats.mean ?? 0;
  let candidates;
  if (peak >= 1200) candidates = '空调、热水器或其他大功率负载';
  else if (peak >= 300) candidates = '洗衣机、电脑或其他中等功率负载';
  else if (peak >= 80) candidates = '电视、电脑或冰箱';
  else candidates = '路由器、小型待机设备或其他低功率负载';
  return `候选类型：${candidates}。\n依据：最近 24 小时 ${stats.sampleCount} 条功率记录，平均约 ${Math.round(mean)} W，峰值约 ${Math.round(peak)} W。\n仅凭功率无法可靠识别电器，组合负载和间歇运行也会影响判断。请以实际连接的电器为准。此结果由演示规则生成，未调用 AI 模型。`;
}
