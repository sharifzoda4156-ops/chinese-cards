const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const screenshots = path.join(root, 'test-output');
fs.mkdirSync(screenshots, {recursive:true});
const deck = JSON.parse(fs.readFileSync(path.join(root, 'decks/lesson1.json')));
const sourceWords = {
  lesson1: '以为 像 长 身高 米 瘦 接 行李 丢 箱子 号码 好像 重要 着急 护照 服务台 应该 站 中间 短 头发 年轻 发现 不见 带 帮助 照片',
  lesson2: '菜单 又 饿 渴 客气 饮料 好久 服务 员 双 筷子 勺子 碗 马上 热情 尝 记 用 鸡 张 不用 选 外卖 方便 蛋糕 只 方便面 简单',
  lesson3: '初中 咱们 换 房子 小区 环境 挺 空调 洗衣机 层 花园 灯 关 冰箱 卫生间 打扫 搬家 办 信用卡 还 听说 银行 才 纸 搬 需要',
  lesson4: '假期 海 草原 主意 骑 马 羊 月亮 一定 刻 起飞 宾馆 特别 别的 一样 牛 相机 欢迎 司机 晚点 久 除了 以外 先 一直 干净 满意',
  lesson5: '总是 终于 爬 山 锻炼 照 鞋 大衣 拍照 感兴趣 照相 难看 比较 水平 太阳 树 干 电 收到 封 邮件 难过 哈哈 音乐 兴趣 会 结束',
  lesson6: '该 打算 高铁 行 路口 小心 迟到 红绿灯 后来 急 如果 以前 耳机 充电宝 常用 越 分开 检查 刷 检票 电梯 放假 沙发 安静 选择 必须',
  lesson7: '辆 自行车 旧 矮 试 黄色 短裤 大小 合适 裤子 更 决定 西瓜 新鲜 甜 公斤 冰 极 斤 香蕉 一共 毛 结婚 不但 而且 声 开机',
  lesson8: '最近 常常 体育馆 习惯 胖 健康 以后 羽毛球 耳朵 感冒 发烧 低 关心 注意 突然 住院 担心 腿 病人 差不多 得 开心 出院 开 种 方法 其他 心里',
  lesson9: '校园 卡 操场 运动会 男生 练 参加 网球 比赛 练习 好多 几乎 只是 啤酒 吧 紧张 主要 受到 影响 得分 体育 世界 运动 得到 成绩',
  lesson10: '数学 认真 笔记 清楚 黑板 把 作业 遍 提高 历史 难 要求 差 复习 外语 当然 遇到 办公室 页 对话 明白 讲 句 句子 年级 后年 一般 努力',
  lesson11: '会议 经理 开会 后天 地点 室 发 笔记本 或者 声音 看来 办法 解决 只能 别人 请假 同事 休假 怕 邮箱 愿意 城市 离开 机会 生活 为 或',
  lesson12: '街 开花 公园 船 工作日 地方 刚才 刮 风 新闻 伞 借 把 雨衣 变 季节 变化 冬天 常常 关注 四季 春天 夏天 凉快 秋天 叶子 变成',
  lesson13: '请客 南方 北方 做法 不同 加 的话 做客 邻居 放心 酒 放 客人 晚会 礼物 画家 盘子 一边 聊天儿 来自 夫妻 直到 地图 点 感到 东方 文化',
  lesson14: '词典 最好 节 图书馆 被 名人 故事 然后 报纸 忘记 电子书 女生 表演 节目 怎么办 校长 面前 有些 相信 新年 班级 跳 留学生 最后 一块儿 网站 视频',
  lesson15: '蓝 段 附近 马路 平时 放学 游戏 老人 根据 了解 可是 以上 有名 景点 游客 外地 聊 河 关系 养 西北 经过 草地 遇见',
  lesson16: '脏 可爱 一会儿 脚 照顾 好像 认得 周末 动物园 动物 大熊猫 奇怪 其实 竹子 国宝 全 野生 关于 饱 张 嘴 身边 半天 脸 大人 喜爱',
  lesson17: '向 楼梯 害怕 生气 常见 聪明 错 认为 到处 继续 同意 可 屋子 有关 关机 前天 留学 国家 比如 查 有用 容易 回答 方向 只有 真正 难题',
  lesson18: '怎样 过节 节 节日 联欢 大概 阿姨 叔叔 收 总 起 见面 矿泉水 刚刚 出发 不久 发生 刚 只要 学期 毕业 出生 过去 懂得 坚持 完成 目标 发展'
};
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'decks/catalog.json')));
const hsk3Section = catalog.sections.find(s => s.id === 'hsk3');
const hsk2Section = catalog.sections.find(s => s.id === 'hsk2');
const hsk1Section = catalog.sections.find(s => s.id === 'hsk1');
const hsk4aSection = catalog.sections.find(s => s.id === 'hsk4a');
const hsk4bSection = catalog.sections.find(s => s.id === 'hsk4b');
assert.ok(hsk1Section && hsk2Section && hsk3Section && hsk4aSection && hsk4bSection);
assert.deepEqual(catalog.sections.map(s => s.id), ['hsk1', 'hsk2', 'hsk3', 'hsk4a', 'hsk4b']);
assert.deepEqual(hsk4aSection.lessons.map(l => l.id), Array.from({length:10},(_,i)=>'hsk4a-lesson'+(i+1)));
assert.deepEqual(hsk4bSection.lessons.map(l => l.id), Array.from({length:10},(_,i)=>'hsk4b-lesson'+(i+11)));
assert.deepEqual(hsk4aSection.lessons.filter(l => l.available).map(l => l.id), Array.from({length:10},(_,i)=>'hsk4a-lesson'+(i+1)));
assert.deepEqual(hsk4bSection.lessons.filter(l => l.available).map(l => l.id), Array.from({length:4},(_,i)=>'hsk4b-lesson'+(i+11)));
assert.equal(hsk2Section.lessons.length, 15);
// A/B volume structure follows the printed contents. Only completed decks are clickable.
const hsk4Sources = [
  {section:hsk4aSection,id:'hsk4a-lesson1',count:40,words:'签证 入学 通知 证件 材料 证 任何 食堂 座 申请 奖学金 表现 获得 要是 减轻 经济 压力 加油 随着 课程 专业 本科 硕士 研究生 博士 研究 活动 通过 交流 适应 将来 国际 当 教育 成为 教师 贸易 方面 知识 另'},
  {section:hsk4aSection,id:'hsk4a-lesson2',count:37,words:'房东 出租 房租 收拾 租 嗯 亮 就是 种 周围 不过 毕业 恐怕 热闹 入住 日记 顺利 并 客厅 台 厨房 平常 基本上 整个 毛巾 建议 查看 信息 查找 接着 同时 位置 价格 理想 由于 工资 感'},
  {section:hsk4aSection,id:'hsk4a-lesson3',count:40,words:'十字路口 直接 转 正好 熟悉 正 目的地 下载 进行 支付 软件 不仅 扫码 结账 购物 订 快递 现金 网购 寄 等 货 甚至 改变 手指 乱 管 提供 身份证 个人 能否 保护 于是 密码 随便 技术 法律 手段 保证 网络'},
  {section:hsk4aSection,id:'hsk4a-lesson4',count:39,words:'啊 停 交 费 信号 感谢 联系 方式 客气 剩 提 袋子 重 算 再说 之间 互相 辛苦 出行 距离 往往 既 电动车 速度 充电 流行 省 力气 乘客 购买 食物 免费 早餐 来得及 鲜花 顺便 心情 更加 愉快'},
  {section:hsk4aSection,id:'hsk4a-lesson5',count:38,words:'至少 中餐 专门 煮 油 道 熟 倒 辣椒 辣 敢 肚子 相同 顺序 够 不够 达到 聚 午餐 咸 凉 酸 汤 各 付 聚餐 随意 正式 普通 重视 座位 安排 按照 年龄 面对 主人 等 尊重'},
  {section:hsk4aSection,id:'hsk4a-lesson6',count:39,words:'咳嗽 咳 厉害 严重 赶快 陪 翻译 护士 表 性别 国籍 家庭 地址 挂号 排队 大厅 偶尔 身 结果 性 体温 降 光 打针 有效 按时 汗 醒 感觉 低 难受 通 过程 部 收费 情况 好 治疗 步'},
  {section:hsk4aSection,id:'hsk4a-lesson7',count:39,words:'打扰 市场 调查 计划 内容 改 细心 客户 真正 想法 任务 及时 出差 经验 采访 产品 看法 提前 便于 既然 谈 笔 生意 困难 优点 缺点 实际 效果 点 一下 份 积累 使 进入 社会 管理 基础 能力 今后'},
  {section:hsk4aSection,id:'hsk4a-lesson8',count:38,words:'紧张 放松 呀 不管 郊区 游玩 主意 外出 戴 帽子 项目 加班 熬夜 否则 失去 值得 暂停 之后 风景 效率 下降 相比 因此 提醒 与 大自然 美丽 景色 首都 市区 眼前 美景 参观 景点 交通 乘坐 十分 实际上'},
  {section:hsk4aSection,id:'hsk4a-lesson9',count:40,words:'祝 巧克力 感动 浪漫 幽默 耐心 吸引 当时 错过 幸运 幸福 尽管 性格 共同 责任 相互 理解 支持 印象 实在 阳光 负责 积极 此 从此 产生 爱情 间 友情 美好 人生 精彩 感情 深 经营 对方 感受 尤其 日子 从来'},
  {section:hsk4aSection,id:'hsk4a-lesson10',count:41,words:'小伙子 气温 零下 度 冻 后悔 就是 温度 差别 厚 寒假 暖和 低于 摄氏度 受不了 举办 各种 植物 公里 气候 而 此外 方言 普通话 较 使用 引起 误会 亲爱 再次 开展 绿色 环保 拒绝 浪费 节约 资源 光 垃圾 分类 日常'},
  {section:hsk4bSection,id:'hsk4b-lesson11',count:41,words:'老年 散步 丰富 羡慕 即使 活 继续 网友 无聊 数字 点名 教授 线上 线下 视频 记录 资料 自学 口语 科技 获取 礼貌 打招呼 家长 成功 分数 目的 养成 留 做法 棒 一生 快速 优秀 律师 仍 准时 网页 弹 钢琴 重新'},
  {section:hsk4bSection,id:'hsk4b-lesson12',count:43,words:'毛衣 样子 适合 售货员 质量 强 年底 全 打折 值 估计 期 听力 烦 脱 挂 脾气 伤心 批评 道歉 老家 自 父母 父子 母子 无论 条件 允许 另外 卫生 母亲 待 将 闻 味道 冷静 鼻子 父亲 城 鲜 暖 勇敢 商量'},
  {section:hsk4bSection,id:'hsk4b-lesson13',count:43,words:'熊 老虎 喊 级 树林 景区 区 美 节假日 千万 开玩笑 月饼 葡萄 香 街道 剧院 演出 赶 巧 之中 铁路 人员 反向 团圆 左右 大约 烤 西红柿 出现 作为 传统 有着 意义 到来 美食 年夜饭 回忆 童年 记忆 已 中年 仍然 兄弟'},
  {section:hsk4bSection,id:'hsk4b-lesson14',count:41,words:'茶叶 究竟 分为 抱歉 暂时 满 两 超过 盒子 装 各位 顾客 本 假日 低价 促销 广播 减 广告 首先 牌子 降价 样式 价钱 商业 商品 种类 盲盒 缺 许多 表示 加上 态度 友好 使得 者 仔细 对于 不光 外套 袜子'}
];
const hsk4Decks = {};
for (const source of hsk4Sources) {
  const lesson = source.section.lessons.find(l => l.id === source.id);
  const data = JSON.parse(fs.readFileSync(path.join(root, 'decks', source.id+'.json')));
  hsk4Decks[source.id] = data;
  assert.equal(lesson.wordCount, source.count);
  assert.equal(data.words.length, source.count);
  assert.deepEqual(data.words.map(w => w.hanzi), source.words.split(' '), source.id + ': source word order');
  assert.equal(new Set(data.words.map(w => w.id)).size, source.count, source.id + ': duplicate IDs');
  const prompts = new Set();
  for (const w of data.words) {
    for (const field of ['id','hanzi','pinyin','ru','sentence','sentencePinyin','sentenceRu'])
      assert.ok(w[field]?.trim(), source.id+'/'+w.id+': missing '+field);
    assert.match(w.id, /^[a-z0-9_-]+$/);
    assert.equal(w.sentence.split('___').length, 2);
    assert.ok(!w.sentencePinyin.includes('___') && !w.sentenceRu.includes('___'));
    const prompt = w.sentence.replace('___','').replace(/\s/g,'');
    assert.ok(!prompts.has(prompt), source.id+': ambiguous duplicate quiz prompt');
    prompts.add(prompt);
    for (const excluded of w.quizExcludes||[]) assert.ok(data.words.some(x => x.id === excluded && x.id !== w.id));
  }
}
// HSK-1 words are copied in source order from the three 生词 blocks of each lesson.
// Repeated textbook entries (e.g. 天, 上) remain separate cards with distinct IDs.
const hsk1Reference = [
  '你好 大家 好 学生 们 老师 您 你们 谢谢 不客气 同学 再见',
  '请问 你 叫 什么 名字 我 不 是 对不起 没关系 没事 很 高兴 认识 也',
  '人 的 这 谁 女朋友 哪 国 她 喂 姐姐 工作 还 忙 吗 对 太 我们 想',
  '有 多少 个 哥哥 呢 没有 家 几 口 爸爸 妈妈 妹妹 和 儿子 孩子 女儿 岁 他 今年 多 大',
  '今天 号 月 日 星期 星期日 星期天 休息 会 做饭 做 面条儿 饺子 一些 菜 下班 新 电脑 真 好看 喜欢 它',
  '手机 电话 号 明天 去 哪儿 想 超市 买 东西 些 牛奶 吃 晚饭 那边 包子 非常 好吃 米饭 怎么 坐 出租车',
  '现在 点 早上 上午 分 课 下午 见 吧 电影院 看 电影 事 上课 呢 半 下课 在 家 里 晚上 医院 上班 店 菜 分钟 后',
  '房间 外 只 小 猫 没 看见 桌子 下 漂亮 在 学校 书店 前 能 到 午饭 饭 大 病人 多 医生 工作',
  '前边 边 家 那个 外边 椅子 上 本 书 第 学习 做 白天 读书 和 朋友 唱 歌 好听 电视 狗 玩',
  '杯子 售货员 这边 钱 这些 块 那些 这儿 水果 少 斤 苹果 便宜 商店 衣服 件 元 怎么样 贵 穿 女 男 那儿',
  '时候 饭店 知道 正在 找 开车 车 在 读 大学 大学生 学 医 弟弟 起来 睡觉 睡 那里 哪里 昨天 问 对 说 要 小朋友',
  '天气 这里 天 下雨 了 雨 有点儿 觉得 冷 下 雪 来 公司 生病 看病 病 一点儿 药 天 回 再 喝 热 水',
  '可以 再 问题 卖 打电话 一下 服务员 小姐 请 坐 给 杯 要 早饭 这个 面包 鸡蛋 先生 一半 茶',
  '上 火车 火车站 开 有些 有的 了 写 都 听见 不要 说话 听 哪些 字 明年 上 中学 小学 中学生 小学生 上学 他们 她们 它们 晚',
  '爱 哪个 去年 男朋友 几 年 好玩儿 飞机 要 小时 家人 时间 机场 接 住 早 啊'
];
assert.equal(hsk1Section.lessons.length, 15);
assert.deepEqual(hsk1Section.lessons.filter(l => l.available).map(l => l.id), hsk1Reference.map((_,i) => 'hsk1-lesson' + (i+1)));
const hsk1Decks = {};
let hsk1CardCount = 0;
for (let i = 0; i < hsk1Section.lessons.length; i++) {
  const lesson = hsk1Section.lessons[i];
  const data = JSON.parse(fs.readFileSync(path.join(root, 'decks', lesson.id + '.json')));
  hsk1Decks[lesson.id] = data;
  hsk1CardCount += data.words.length;
  assert.deepEqual(data.words.map(w => w.hanzi), hsk1Reference[i].split(' '), lesson.id + ': textbook order');
  assert.equal(data.words.length, lesson.wordCount, lesson.id);
  const ids = new Set(data.words.map(w => w.id));
  assert.equal(ids.size, data.words.length, lesson.id + ': unique IDs');
  for (const w of data.words) {
    for (const field of ['id','hanzi','pinyin','ru','sentence','sentencePinyin','sentenceRu'])
      assert.ok(w[field]?.trim(), lesson.id + '/' + w.id + ': missing ' + field);
    assert.match(w.id, /^[a-z0-9_-]+$/);
    assert.equal(w.sentence.split('___').length, 2, lesson.id + '/' + w.id + ': exactly one blank');
    assert.ok(!w.sentencePinyin.includes('___') && !w.sentenceRu.includes('___'));
    for (const id of w.quizExcludes || []) assert.ok(ids.has(id) && id !== w.id, lesson.id + '/' + w.id + ': invalid exclusion');
    assert.ok(data.words.filter(x => x.id !== w.id && !(w.quizExcludes || []).includes(x.id)).length >= 3);
    if (w.audioText) assert.ok(w.audioNote, lesson.id + '/' + w.id + ': audio context requires a note');
  }
}
assert.equal(hsk1CardCount, 317);
for (const id of ['tian_weather','tian_day']) {
  const w = hsk1Decks['hsk1-lesson12'].words.find(x => x.id === id);
  assert.ok(w.quizExcludes.includes(id === 'tian_weather' ? 'tian_day' : 'tian_weather'));
}
for (const id of ['tamen_mixed','tamen_women','tamen_objects']) {
  const w = hsk1Decks['hsk1-lesson14'].words.find(x => x.id === id);
  assert.equal(w.quizExcludes.length, 2);
}
const hsk2Reference = [
  '就 给 让 接 次 旅游 帮忙 不好意思 已经 那 介绍 有时 懂 意思',
  '公交车 但 车站 远 打车 还是 啊 万 名 网上 外国 间 教室 票 别 过来',
  '回来 这么 完 一起 出去 洗 自己 拿 手 为什么 不错 送 回去 每 累',
  '过 商场 进去 条 裤子 白色 因为 试 红色 所以 书包 过去 绿色 黑色 更 颜色',
  '快 下来 上来 上去 下面 面 等 一会儿 下去 进来 爷爷 奶奶 礼物 准备 奶茶 走 酒店',
  '生日 忘 画 画笔 蛋糕 快乐 打开 长 鱼 肉 过 地 床 舒服',
  '从 往 跑 打 篮球 运动 踢 足球 球 得 跑步 游泳 游 爱好 开始',
  '手表 左边 左 比 右边 右 记得 爱情片 有意思 点 虽然 但是 花 妻子 丈夫 饭馆',
  '坏 旁边 男孩儿 这样 个子 那么 高 门口 咖啡 离 近 走路 周',
  '开学 门 后面 笔 帮 考试 词 本子 错 题 还是 考 快要 笑',
  '头 疼 经常 动 着 路上 慢 进 药 身体 时 最 药店',
  '事情 晴 正 外面 阴 从小 地铁 楼 站 小时候 好',
  '新年 教 花 希望 上面 洗手间 里面 笔 可能 上网 那样 告诉 班',
  '站 包 过年 没意思 位 前面 房子 小孩儿 女孩儿 姓 眼睛 跳舞',
  '姓名 出国 门票 高中 出门 路 机场 机票 飞 好像 鸟'
];
assert.deepEqual(hsk2Section.lessons.filter(l => l.available).map(l => l.id), hsk2Reference.map((_,i)=>'hsk2-lesson'+(i+1)));
const hsk2Decks = {};
let hsk2CardCount = 0;
for (let i = 0; i < hsk2Section.lessons.length; i++) {
  const lesson = hsk2Section.lessons[i];
  const data = JSON.parse(fs.readFileSync(path.join(root, 'decks', lesson.id + '.json')));
  hsk2Decks[lesson.id] = data;
  hsk2CardCount += data.words.length;
  assert.deepEqual(data.words.map(w => w.hanzi), hsk2Reference[i].split(' '), lesson.id + ': source order');
  assert.equal(data.words.length, lesson.wordCount, lesson.id);
  const ids = new Set(data.words.map(w => w.id));
  assert.equal(ids.size, data.words.length, lesson.id + ': unique word IDs');
  for (const w of data.words) {
    for (const field of ['id','hanzi','pinyin','ru','sentence','sentencePinyin','sentenceRu']) assert.ok(w[field]?.trim(), lesson.id + '/' + w.id + ': ' + field);
    assert.match(w.id, /^[a-z0-9_-]+$/);
    assert.equal(w.sentence.split('___').length, 2, lesson.id + '/' + w.id + ': one blank');
    assert.ok(!w.sentencePinyin.includes('___') && !w.sentenceRu.includes('___'));
    if (w.audioText) assert.ok(w.audioNote, lesson.id + '/' + w.id + ': audio note');
    for (const id of w.quizExcludes || []) assert.ok(ids.has(id) && id !== w.id, lesson.id + '/' + w.id + ': invalid quiz exclusion');
    assert.ok(data.words.filter(x => x.id !== w.id && !(w.quizExcludes || []).includes(x.id)).length >= 3);
  }
}
assert.equal(hsk2CardCount, 210);
const available = hsk3Section.lessons.filter(l => l.available);
assert.equal(hsk3Section.lessons.length, 18);
assert.deepEqual(available.map(l => l.id), Object.keys(sourceWords));
const decks = {};
for (const lesson of available) {
  const data = JSON.parse(fs.readFileSync(path.join(root, `decks/${lesson.id}.json`)));
  decks[lesson.id] = data;
  assert.deepEqual(data.words.map(w => w.hanzi), sourceWords[lesson.id].split(' '), lesson.id);
  assert.equal(new Set(data.words.map(w => w.id)).size, data.words.length);
  assert.equal(lesson.wordCount, data.words.length);
  const ids = new Set(data.words.map(w => w.id));
  for (const w of data.words) {
    for (const field of ['id', 'hanzi', 'pinyin', 'ru', 'sentence', 'sentencePinyin', 'sentenceRu']) assert.ok(w[field]?.trim(), `${lesson.id}/${w.id}: ${field}`);
    assert.match(w.id, /^[a-z0-9_-]+$/);
    assert.equal(w.sentence.split('___').length, 2);
    assert.ok(!w.sentencePinyin.includes('___'));
    assert.ok(!w.sentenceRu.includes('___'));
    for (const id of w.quizExcludes || []) assert.ok(ids.has(id) && id !== w.id, `${lesson.id}/${w.id}: bad exclusion ${id}`);
    assert.ok(data.words.filter(x => x.id !== w.id && !(w.quizExcludes || []).includes(x.id)).length >= 3);
    if (w.audioText) assert.ok(w.audioNote, `${lesson.id}/${w.id}: missing audio explanation`);
  }
}
// Explicit synonym groups: neither may be an incorrect answer for the other.
for (const id of ['paizhao','zhaoxiang']) {
  const w = decks.lesson5.words.find(w => w.id === id);
  assert.ok(w.quizExcludes.includes(id === 'paizhao' ? 'zhaoxiang' : 'paizhao'));
  assert.ok(w.quizExcludes.includes('zhao'));
}
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, name === '/' ? 'index.html' : name);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const type = {'.js':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html'}[path.extname(file)];
    res.writeHead(200, {'Content-Type':type || 'application/octet-stream'}).end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({headless:true, args:['--no-sandbox']});
  const errors = [];
  const page = await browser.newPage({ viewport:{width:390,height:844}, reducedMotion:'reduce' });
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.addInitScript(() => {
    const original = window.setTimeout;
    window.setTimeout = (fn, ms, ...args) => original(fn, ms === 280 ? 0 : ms, ...args);
    document.addEventListener('DOMContentLoaded', () => {
      const style=document.createElement('style');
      style.textContent='*, *::before, *::after { animation: none !important; transition: none !important; }';
      document.head.appendChild(style);
    });
    window.played = [];
    window.Audio = class { constructor(src) { this.src = src; } pause() {} addEventListener() {} play() { window.played.push(this.src); return Promise.resolve(); } };
    Object.defineProperty(navigator, 'share', {value: async data => { window.shared = data; }});
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const visible = id => page.locator(`#screen-${id}`).waitFor({state:'visible'});
  const tick = () => page.waitForTimeout(15);
  try {
    await page.goto(base);
    await page.locator('#btn-start').click(); await visible('sections');
    assert.equal(await page.locator('#sections button').count(), 5);
    assert.equal(await page.locator('#sections button').first().innerText(), 'HSK-1\n新HSK教程 1 · 15 уроков\nДоступно 15 из 15 уроков →');
    assert.equal(await page.locator('#sections button').nth(1).innerText(), 'HSK-2\n新HSK教程 2 · 15 уроков\nДоступно 15 из 15 уроков →');
    assert.equal(await page.locator('#sections button').nth(2).innerText(), 'HSK-3\n新HSK教程 3 · 18 уроков\nДоступно 18 из 18 уроков →');
    assert.equal(await page.locator('#sections button').nth(3).innerText(), 'HSK-4A\n新HSK教程 4 上 · 10 уроков\nДоступно 10 из 10 уроков →');
    assert.equal(await page.locator('#sections button').nth(4).innerText(), 'HSK-4B\n新HSK教程 4 下 · 10 уроков\nДоступно 4 из 10 уроков →');
    await page.locator('#sections button').first().click(); await visible('lessons');
    assert.equal(await page.locator('#lessons button').count(), 15);
    assert.equal(await page.locator('#lessons button:disabled').count(), 0);
    await page.locator('#btn-sections').click(); await visible('sections');
    await page.locator('#sections button').nth(1).click(); await visible('lessons');
    assert.equal(await page.locator('#lessons button').count(), 15);
    assert.equal(await page.locator('#lessons button:disabled').count(), 0);
    await page.locator('#btn-sections').click(); await visible('sections');
    await page.locator('#sections button').nth(2).click(); await visible('lessons');
    assert.equal(await page.locator('#lessons button').count(), 18);
    assert.equal(await page.locator('#lessons button:disabled').count(), 0);
    await page.screenshot({path:path.join(screenshots,'hsk3-lessons.png')});
    await page.locator('#lessons button').first().click(); await visible('lesson');
    await page.locator('#btn-begin').click(); await visible('cards');
    // First unknown card: reveal all fields and check both audio routes.
    const first = await page.locator('#front-hanzi').innerText();
    const firstWord = deck.words.find(w => w.hanzi === first);
    await page.locator('#btn-no').click();
    assert.equal(await page.locator('#back-ru').innerText(), firstWord.ru);
    await page.locator('#btn-audio-ex').click();
    assert.deepEqual(await page.evaluate(() => window.played), [`audio/lesson1/${firstWord.id}.mp3`, `audio/lesson1/${firstWord.id}_s.mp3`]);
    await page.screenshot({path:path.join(screenshots,'hsk3-card.png')});
    await page.locator('#btn-next').click(); await tick();
    // Remaining initial cards + repeated card: learn every word.
    const seen = new Set([first]);
    for (let i=0;i<27;i++) {
      seen.add(await page.locator('#front-hanzi').innerText());
      await page.locator('#btn-yes').evaluate(b => { b.click(); b.click(); }); await tick();
    }
    assert.equal(seen.size, 27); await visible('test');
    // Answer all questions, intentionally get the first wrong; double clicks count once.
    for (let i=0;i<27;i++) {
      const displayed = await page.locator('#q-sentence').innerText();
      const w = deck.words.find(w => displayed.replace(/\s/g,'') === w.sentence.replace('___','').replace(/\s/g,''));
      assert.ok(w, displayed);
      const selector = i===0 ? `#options button:not([data-id="${w.id}"])` : `#options button[data-id="${w.id}"]`;
      await page.locator(selector).first().evaluate(b => { b.click(); b.click(); });
      assert.equal(await page.locator('#options button:disabled').count(), 4);
      await page.locator('#btn-test-next').evaluate(b => { b.click(); b.click(); });
    }
    await visible('result');
    assert.equal(await page.locator('#score-num').innerText(), '26/27');
    assert.match(await page.locator('#stats').innerText(), /26\s+знал сразу\s+1\s+выучил\s+0\s+не выучил/);
    await page.locator('#btn-share').click();
    assert.match((await page.evaluate(() => window.shared)).text, /HSK-3 · Урок 1/);
    await page.locator('#btn-result-lessons').click(); await visible('lessons');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    // Direct links, unavailable/unknown lessons and retry on a failed fetch.
    await page.goto(base+'/?deck=lesson18'); await visible('lesson');
    await page.waitForFunction(() => !document.getElementById('btn-begin').disabled);
    assert.equal(await page.locator('#deck-title').innerText(), 'HSK-3 · Урок 18');
    await page.goto(base+'/?deck=missing'); await visible('lesson');
    assert.match(await page.locator('#deck-info').innerText(), /Такого урока нет/);
    let fail=true;
    await page.route('**/decks/lesson1.json', route => fail ? route.fulfill({status:503,body:''}) : route.continue());
    await page.goto(base+'/?deck=lesson1'); await page.locator('#btn-deck-retry').waitFor({state:'visible'});
    fail=false; await page.locator('#btn-deck-retry').click();
    await page.waitForFunction(() => !document.getElementById('btn-begin').disabled);
    await page.locator('#btn-begin').click();
    // Three misses retire each word; when none learned the test still covers all 27.
    for(let i=0;i<81;i++) { await page.locator('#btn-no').click(); await page.locator('#btn-next').click(); await tick(); }
    await visible('test'); assert.match(await page.locator('#test-text').innerText(), /из 27/);
    // Complete every new deck through the same menu a learner uses.
    for (const lesson of available.slice(1)) {
      const data = decks[lesson.id];
      await page.goto(base);
      await page.locator('#btn-start').click();
      await page.locator('#sections button').nth(2).click();
      await page.getByRole('button', {name:`${lesson.title} ${lesson.wordCount} слов · карточки и тест`,exact:true}).click();
      await page.locator('#btn-begin').click(); await visible('cards');
      const seen = new Set();
      for (let i=0;i<data.words.length;i++) {
        const hanzi = await page.locator('#front-hanzi').innerText();
        const w = data.words.find(w => w.hanzi === hanzi);
        assert.ok(w, `${lesson.id}: unexpected ${hanzi}`);
        seen.add(hanzi);
        // Reveal every card and verify translations, full examples, pronunciation notes and audio paths.
        await page.locator('#btn-no').click();
        assert.equal(await page.locator('#back-ru').innerText(), w.ru);
        assert.equal((await page.locator('#back-ex-zh').innerText()).replace(/\s/g,''), w.sentence.replace('___',w.hanzi).replace(/\s/g,''));
        const notes = [w.audioNote,w.note].filter(Boolean).join(' ');
        assert.equal(await page.locator('#audio-note').textContent(), notes);
        await page.locator('#btn-audio-ex').click();
        assert.deepEqual(await page.evaluate(() => window.played.slice(-2)), [`audio/${lesson.id}/${w.id}.mp3`,`audio/${lesson.id}/${w.id}_s.mp3`]);
        if(i===0) await page.screenshot({path:path.join(screenshots,`${lesson.id}-card.png`)});
        await page.locator('#btn-next').click(); await tick();
      }
      assert.equal(seen.size,data.words.length);
      // All cards return once, then mark every word learned.
      for (let i=0;i<data.words.length;i++) {
        await page.locator('#btn-yes').evaluate(b => b.click()); await tick();
      }
      await visible('test');
      for (let i=0;i<data.words.length;i++) {
        const text = await page.locator('#q-sentence').innerText();
        const w = data.words.find(w => text.replace(/\s/g,'')===w.sentence.replace('___','').replace(/\s/g,''));
        assert.ok(w, `${lesson.id}: unexpected question ${text}`);
        const options = await page.locator('#options button').evaluateAll(bs => bs.map(b => b.dataset.id));
        assert.equal(options.length,4);
        assert.equal(new Set(options).size,4);
        assert.ok(options.includes(w.id));
        for(const excluded of w.quizExcludes || []) assert.ok(!options.includes(excluded), `${w.id}: ambiguous answer ${excluded}`);
        await page.locator(`#options button[data-id="${w.id}"]`).click();
        await page.locator('#btn-test-next').click();
      }
      await visible('result');
      assert.equal(await page.locator('#score-num').innerText(), `${data.words.length}/${data.words.length}`);
      await page.locator('#btn-share').click();
      assert.ok((await page.evaluate(() => window.shared)).text.includes(data.title));
      await page.locator('#btn-result-lessons').click(); await visible('lessons');
    }
    // Run complete card and quiz flows for every HSK-2 lesson, including direct links.
    for (const lesson of hsk2Section.lessons) {
      const data = hsk2Decks[lesson.id];
      await page.goto(base + '/?deck=' + lesson.id); await visible('lesson');
      await page.waitForFunction(() => !document.getElementById('btn-begin').disabled);
      assert.equal(await page.locator('#deck-title').innerText(), data.title);
      await page.locator('#btn-begin').click(); await visible('cards');
      const firstHanzi = await page.locator('#front-hanzi').innerText();
      const firstWord = data.words.find(w => w.hanzi === firstHanzi);
      assert.ok(firstWord, lesson.id + ': unknown first word');
      await page.locator('#btn-no').click();
      assert.equal(await page.locator('#back-ru').innerText(), firstWord.ru);
      assert.equal((await page.locator('#back-ex-zh').innerText()).replace(/\s/g,''), firstWord.sentence.replace('___',firstWord.hanzi).replace(/\s/g,''));
      await page.locator('#btn-audio-ex').click();
      assert.deepEqual(await page.evaluate(() => window.played.slice(-2)), [
        'audio/' + lesson.id + '/' + firstWord.id + '.mp3',
        'audio/' + lesson.id + '/' + firstWord.id + '_s.mp3'
      ]);
      await page.locator('#btn-next').click(); await tick();
      for (let i = 0; i < data.words.length; i++) {
        await page.locator('#btn-yes').click(); await tick();
      }
      await visible('test');
      for (let i = 0; i < data.words.length; i++) {
        const shown = await page.locator('#q-sentence').innerText();
        const w = data.words.find(w => shown.replace(/\s/g,'') === w.sentence.replace('___','').replace(/\s/g,''));
        assert.ok(w, lesson.id + ': unexpected quiz question ' + shown);
        const options = await page.locator('#options button').evaluateAll(bs => bs.map(b => b.dataset.id));
        assert.equal(options.length, 4);
        assert.equal(new Set(options).size, 4);
        assert.ok(options.includes(w.id));
        for (const excluded of w.quizExcludes || []) assert.ok(!options.includes(excluded), lesson.id + '/' + w.id + ': ambiguous answer');
        await page.locator('#options button[data-id="' + w.id + '"]').click();
        await page.locator('#btn-test-next').click();
      }
      await visible('result');
      assert.equal(await page.locator('#score-num').innerText(), data.words.length + '/' + data.words.length);
      await page.locator('#btn-share').click();
      assert.ok((await page.evaluate(() => window.shared)).text.includes(data.title));
    }

    // HSK-4A/B: separate top-level sections, only completed lessons enabled.
    await page.goto(base); await page.locator('#btn-start').click(); await visible('sections');
    for (const index of [3,4]) {
      await page.locator('#sections button').nth(index).click(); await visible('lessons');
      assert.equal(await page.locator('#lessons button').count(), 10);
      assert.equal(await page.locator('#lessons button:disabled').count(), index === 3 ? 0 : 6);
      assert.ok((await page.locator('#lessons button').first().innerText()).includes(index === 3 ? '40 слов' : '41 слов'));
      if (index === 3) {
        assert.ok((await page.locator('#lessons button').nth(1).innerText()).includes('37 слов'));
        assert.ok((await page.locator('#lessons button').nth(2).innerText()).includes('40 слов'));
        assert.ok((await page.locator('#lessons button').nth(3).innerText()).includes('39 слов'));
        assert.ok((await page.locator('#lessons button').nth(4).innerText()).includes('38 слов'));
        assert.ok((await page.locator('#lessons button').nth(5).innerText()).includes('39 слов'));
        assert.ok((await page.locator('#lessons button').nth(6).innerText()).includes('39 слов'));
        assert.ok((await page.locator('#lessons button').nth(7).innerText()).includes('38 слов'));
        assert.ok((await page.locator('#lessons button').nth(8).innerText()).includes('40 слов'));
        assert.ok((await page.locator('#lessons button').nth(9).innerText()).includes('41 слов'));
      } else {
        assert.ok((await page.locator('#lessons button').nth(1).innerText()).includes('43 слов'));
        assert.ok((await page.locator('#lessons button').nth(2).innerText()).includes('43 слов'));
        assert.ok((await page.locator('#lessons button').nth(3).innerText()).includes('41 слов'));
      }
      await page.locator('#btn-sections').click(); await visible('sections');
    }
    // All ready HSK-4A lessons (1–10) / HSK-4B lessons 11–14: cards, audio, quiz, score, share.
    for (const source of hsk4Sources) {
      const data = hsk4Decks[source.id];
      await page.goto(base + '/?deck=' + source.id); await visible('lesson');
      await page.waitForFunction(() => !document.getElementById('btn-begin').disabled);
      assert.equal(await page.locator('#deck-title').innerText(), data.title);
      await page.locator('#btn-begin').click(); await visible('cards');
      const firstHanzi = await page.locator('#front-hanzi').innerText();
      const firstWord = data.words.find(w => w.hanzi === firstHanzi);
      assert.ok(firstWord, source.id+': unknown first word');
      await page.locator('#btn-no').click();
      assert.equal(await page.locator('#back-ru').innerText(), firstWord.ru);
      assert.equal((await page.locator('#back-ex-zh').innerText()).replace(/\s/g,''), firstWord.sentence.replace('___',firstWord.hanzi).replace(/\s/g,''));
      await page.locator('#btn-audio-ex').click();
      assert.deepEqual(await page.evaluate(() => window.played.slice(-2)), [
        'audio/' + source.id + '/' + firstWord.id + '.mp3',
        'audio/' + source.id + '/' + firstWord.id + '_s.mp3'
      ]);
      await page.screenshot({path:path.join(screenshots,source.id+'-card.png')});
      await page.locator('#btn-next').click(); await tick();
      for (let i=0;i<data.words.length;i++) {
        await page.locator('#btn-yes').click(); await tick();
      }
      await visible('test');
      for (let i=0;i<data.words.length;i++) {
        const shown = await page.locator('#q-sentence').innerText();
        const w = data.words.find(w => shown.replace(/\s/g,'') === w.sentence.replace('___','').replace(/\s/g,''));
        assert.ok(w, source.id+': unknown quiz prompt '+shown);
        const options = await page.locator('#options button').evaluateAll(bs => bs.map(b=>b.dataset.id));
        assert.equal(options.length, 4);
        assert.equal(new Set(options).size, 4);
        assert.ok(options.includes(w.id));
        for (const excluded of w.quizExcludes || [])
          assert.ok(!options.includes(excluded), source.id+'/'+w.id+': ambiguous distractor '+excluded);
        await page.locator('#options button[data-id="'+w.id+'"]').click();
        await page.locator('#btn-test-next').click();
      }
      await visible('result');
      assert.equal(await page.locator('#score-num').innerText(), data.words.length+'/'+data.words.length);
      await page.locator('#btn-share').click();
      assert.ok((await page.evaluate(() => window.shared)).text.includes(data.title));
    }

    // HSK-1: direct links, all words, both audio routes, all quiz questions and result.
    for (const lesson of hsk1Section.lessons) {
      const data = hsk1Decks[lesson.id];
      await page.goto(base + '/?deck=' + lesson.id); await visible('lesson');
      await page.waitForFunction(() => !document.getElementById('btn-begin').disabled);
      assert.equal(await page.locator('#deck-title').innerText(), data.title);
      await page.locator('#btn-begin').click(); await visible('cards');
      // The app shuffles cards; identify each by both hanzi and translation.
      const seenIds = new Set();
      for (let i = 0; i < data.words.length; i++) {
        const hanzi = await page.locator('#front-hanzi').innerText();
        await page.locator('#btn-no').click();
        const translation = await page.locator('#back-ru').innerText();
        const w = data.words.find(x => x.hanzi === hanzi && x.ru === translation);
        assert.ok(w, lesson.id + ': unknown card ' + hanzi + ' / ' + translation);
        seenIds.add(w.id);
        assert.equal((await page.locator('#back-ex-zh').innerText()).replace(/\s/g,''), w.sentence.replace('___',w.hanzi).replace(/\s/g,''));
        await page.locator('#btn-audio-ex').click();
        assert.deepEqual(await page.evaluate(() => window.played.slice(-2)), ['audio/' + lesson.id + '/' + w.id + '.mp3', 'audio/' + lesson.id + '/' + w.id + '_s.mp3']);
        if (i === 0) await page.screenshot({path:path.join(screenshots,lesson.id + '-card.png')});
        await page.locator('#btn-next').click(); await tick();
      }
      assert.equal(seenIds.size, data.words.length, lesson.id + ': unique shuffled cards');
      // First pass all marked unknown; second pass learned.
      for (let i=0; i<data.words.length; i++) {
        await page.locator('#btn-yes').click(); await tick();
      }
      await visible('test');
      for (let i=0; i<data.words.length; i++) {
        const shown = await page.locator('#q-sentence').innerText();
        const w = data.words.find(x => shown.replace(/\s/g,'') === x.sentence.replace('___','').replace(/\s/g,''));
        assert.ok(w, lesson.id + ': unrecognized question ' + shown);
        const options = await page.locator('#options button').evaluateAll(bs => bs.map(b => b.dataset.id));
        assert.equal(options.length, 4);
        assert.equal(new Set(options).size, 4);
        assert.ok(options.includes(w.id));
        for (const excluded of w.quizExcludes || []) assert.ok(!options.includes(excluded), lesson.id + '/' + w.id + ': ambiguous option');
        await page.locator('#options button[data-id="' + w.id + '"]').click();
        await page.locator('#btn-test-next').click();
      }
      await visible('result');
      assert.equal(await page.locator('#score-num').innerText(), data.words.length + '/' + data.words.length);
      await page.locator('#btn-share').click();
      assert.ok((await page.evaluate(() => window.shared)).text.includes(data.title));
    }

    // Telegram start_param takes priority over browser query.
    await page.addInitScript(() => { window.Telegram={WebApp:{initData:'test',initDataUnsafe:{start_param:'lesson1'},ready(){},expand(){}}}; });
    await page.goto(base+'/?deck=lesson2'); await visible('lesson');
    await page.waitForFunction(() => !document.getElementById('btn-begin').disabled);
    assert.equal(await page.locator('#deck-title').innerText(), 'HSK-3 · Урок 1');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS: HSK-1 (15/317), HSK-2 (15/210), HSK-3 (18/482), HSK-4A (10/391), HSK-4B (4/168), 1568 cards, mobile navigation, synonym exclusions, audio URLs, repetitions, quiz, duplicate-click guards, report, deep links and fetch retry.');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode=1; server.close(); });
