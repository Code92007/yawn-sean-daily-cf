# Yawn-Sean Daily CF Problems

纯静态每日一题索引，数据来自 [Yawn-Sean/Daily_CF_Problems](https://github.com/Yawn-Sean/Daily_CF_Problems)，无需服务器、数据库或 API 密钥。

支持题号 / URL / 已知题名搜索，列出全部出现日期；日期、难度、Div.1 / Div.2 / Div.3 / Div.4 / Global Round / ICPC Mirror / Gym 和完成状态筛选，难度着色，题解和原文链接。输入 Codeforces handle 后，分页读取全部公开提交，以 OK 判断 AC。请求间隔 2.2 秒，失败重试并保留原缓存。提交缓存仅保存在当前浏览器。题格以绿色表示 AC，当天全部题目 AC 后日期格也标绿。

Gym 私有或不可见提交可能无法查询，未查到 AC 不等于没做过，不会标绿。难度取上游仓库，* 表示估计分数。Div 分类根据原题链接的 contestId 查比赛名称；即使题目不在 problemset API 中，也用 contest.list 分类。Div 分类依据比赛名称，联合比赛归入两类；无 Div 标识或无元数据的比赛归入其他，不按难度猜分类。Gym 以原仓库题号展示，部分链接编号与显示编号不同的题两种编号均可搜索。

## 本地运行和测试

```sh
python3 -m http.server 4173 --directory site
python3 -m unittest discover -s tests
node --test tests/core.test.mjs
```

访问 http://localhost:4173 ，不要直接双击 HTML。

## 自动更新和 Pages

Settings → Pages → Source 选择 GitHub Actions。工作流在推送、手动执行和每日 UTC 01:35 / 09:35 / 17:35（北京时间 09:35 / 17:35 / 次日 01:35）运行，从最新上游生成索引、测试并部署 site/。解析异常时停止部署，保留线上版本；CF 元数据更新失败时使用已有缓存。

GitHub 定时任务可能延迟，公开仓库长时间无活动可能暂停定时工作流，可在 Actions 重新启用。

这是第三方索引站，上游题目提示和其他内容归原作者所有。未复制个人解题代码。
