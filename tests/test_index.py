import importlib.util,tempfile,unittest,json,subprocess,sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('build',Path(__file__).resolve().parents[1]/'scripts/build_index.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class ParserTests(unittest.TestCase):
    def test_regular_and_numeric_gym(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            path='daily_problems/2026/02/0220/problems.md'
            rows=module.parse('| *1400 | [GYM106247B](https://codeforces.com/gym/106247/problem/2) | Hint |\n| 2000 | [CF1900E](https://codeforces.com/problemset/problem/1900/E) | Hint |',path,root)
            self.assertEqual(rows[0]['id'],'GYM106247B');self.assertEqual(rows[0]['key'],'gym:106247:2');self.assertEqual(rows[1]['key'],'cf:1900:E');self.assertTrue(rows[0]['estimated']);self.assertFalse(rows[1]['estimated'])
    def test_invalid_date_and_unparsed_file_fail(self):
        with self.assertRaises(ValueError):module.parse('','daily_problems/2026/02/0320/problems.md',Path('.'))
        with self.assertRaises(ValueError):module.parse('unsupported','daily_problems/2026/02/0220/problems.md',Path('.'))

class ClassificationTests(unittest.TestCase):
    def test_contest_fallback_without_problem_metadata(self):
        spec=importlib.util.spec_from_file_location('metadata',Path(__file__).resolve().parents[1]/'scripts/update_metadata.py')
        metadata=importlib.util.module_from_spec(spec);spec.loader.exec_module(metadata)
        data=metadata.merge([{'id':485,'name':'Codeforces Round 276 (Div. 2)'},{'id':2200,'name':'Codeforces Round 1084 (Div. 3)'}],[],{})
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);file=root/'daily_problems/2026/10/1006/problems.md';file.parent.mkdir(parents=True)
            file.write_text('| 2600 | [CF485E](https://codeforces.com/contest/485/problem/E) | Hint |\n| 1600 | [CF2200C](https://codeforces.com/contest/2200/problem/C) | Hint |')
            records={p['id']:p for p in module.build(root,data)['problems']}
            self.assertEqual(records['CF485E']['divisions'],['div2'])
            self.assertEqual(records['CF2200C']['divisions'],['div3'])

    def test_global_icpc_and_div4(self):
        spec=importlib.util.spec_from_file_location('metadata',Path(__file__).resolve().parents[1]/'scripts/update_metadata.py')
        metadata=importlib.util.module_from_spec(spec);spec.loader.exec_module(metadata)
        self.assertEqual(metadata.classify('Codeforces Global Round 8'),['global'])
        self.assertEqual(metadata.classify('Codeforces Round 993 (Div. 4)'),['div4'])
        self.assertEqual(metadata.classify('2018-2019 ICPC, NEERC, Northern Eurasia Finals (Online Mirror)'),['icpc'])
        self.assertEqual(metadata.classify('Codeforces Beta Round (ACM-ICPC Rules)'),['other'])
        self.assertEqual(metadata.classify('Codeforces Round (Div. 1 + Div. 2)'),['div12'])

        self.assertEqual(metadata.classify('Educational Codeforces Round 71 (Rated for Div. 2)'),['educational'])
        self.assertEqual(metadata.classify('Educational Codeforces Round 10'),['educational'])
        self.assertEqual(metadata.classify('Hello 2025'),['div12'])
        self.assertEqual(metadata.classify('Good Bye 2024'),['div12'])
        self.assertEqual(metadata.classify('Testing Round 19 (Div. 3)',2010),['other'])
        self.assertEqual(metadata.classify('think-cell Round 1',1930),['div12'])

class TopicListTests(unittest.TestCase):
    def test_category_editorial_deduplication_and_all_daily_dates(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            for date in ['1005','1006']:
                daily=root/f'daily_problems/2026/10/{date}/problems.md'
                daily.parent.mkdir(parents=True)
                daily.write_text('| 2000 | [CF75D](https://codeforces.com/contest/75/problem/D) | Daily hint |')
            editorial=root/'daily_problems/2026/10/1005/solution/cf75d.md'
            editorial.parent.mkdir();editorial.write_text('Solution')
            categories=root/'categories';categories.mkdir()
            row='| 2000 | [CF75D](https://codeforces.com/problemset/problem/75/D) | DP hint | [Editorial](https://github.com/Yawn-Sean/Daily_CF_Problems/blob/main/daily_problems/2026/10/1005/solution/cf75d.md) |'
            (categories/'DP.md').write_text(row+'\n'+row)
            (categories/'new_topic.md').write_text(row)
            data=module.build(root)
            self.assertEqual(len(data['tracks']),2)
            dp=data['tracks'][0]
            self.assertEqual(dp['label'],'动态规划')
            self.assertEqual(len(dp['problems']),1)
            p=dp['problems'][0]
            self.assertEqual(p['dates'],['2026-10-05','2026-10-06'])
            self.assertEqual(p['hint'],'DP hint')
            self.assertTrue(p['source'].endswith('categories/DP.md'))
            self.assertTrue(p['editorial'].endswith('1005/solution/cf75d.md'))
            self.assertEqual(data['tracks'][1]['label'],'new topic')

    def test_gym_editorial_cf_filename(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);path='daily_problems/2026/10/1006/problems.md'
            file=root/Path(path).parent/'solution/cf100947c.md'
            file.parent.mkdir(parents=True);file.write_text('Solution')
            p=module.parse('| *1000 | [GYM100947C](https://codeforces.com/gym/100947/problem/C) | Hint |',path,root)[0]
            self.assertTrue(p['editorial'].endswith('solution/cf100947c.md'))

class IncrementalTests(unittest.TestCase):
    def test_cli_git_diff_notification_and_approval_round_trip(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)/'upstream';root.mkdir()
            def git(*args):
                return subprocess.check_output(['git','-C',str(root),'-c','user.name=Test','-c','user.email=test@example.com',*args],stderr=subprocess.DEVNULL,text=True).strip()
            git('init')
            file=root/'daily_problems/2020/01/0101/problems.md';file.parent.mkdir(parents=True)
            row='| 2000 | [CF75D](https://codeforces.com/contest/75/problem/D) | Hint |'
            file.write_text(row)
            categories=root/'categories';categories.mkdir();(categories/'DP.md').write_text(row)
            git('add','.');git('commit','-m','Baseline')
            baseline=module.build(root);baseline['upstreamCommit']=git('rev-parse','HEAD')
            output=Path(folder)/'index.json';output.write_text(json.dumps(baseline))
            file.write_text(row.replace('2000','2100'));git('add','.');git('commit','-m','Historical correction')
            spec=importlib.util.spec_from_file_location('history',Path(__file__).resolve().parents[1]/'scripts/history_changes.py')
            history=importlib.util.module_from_spec(spec);spec.loader.exec_module(history)
            head,paths=history.recent_paths(root)
            self.assertEqual(head,git('rev-parse','HEAD'))
            self.assertEqual(paths,['daily_problems/2020/01/0101/problems.md'])
            command=[sys.executable,str(Path(__file__).resolve().parents[1]/'scripts/build_index.py'),str(root),'--output',str(output),'--metadata',str(Path(folder)/'missing.json')]
            subprocess.check_output(command)
            pending=json.loads(output.read_text())
            self.assertEqual(pending['problems'],baseline['problems'])
            self.assertEqual(len(pending['historicalChanges']),1)
            subprocess.check_output(command)
            self.assertEqual(json.loads(output.read_text())['historicalChanges'],pending['historicalChanges'])
            subprocess.check_output(command+['--approve-change',pending['historicalChanges'][0]['id']])
            approved=json.loads(output.read_text())
            self.assertEqual(approved['problems'][0]['rating'],2100)
            self.assertEqual(approved['historicalChanges'],[])
            self.assertEqual(len(approved['historicalApprovals']),1)

    def test_historical_notifications_and_explicit_approval(self):
        spec=importlib.util.spec_from_file_location('history',Path(__file__).resolve().parents[1]/'scripts/history_changes.py')
        history=importlib.util.module_from_spec(spec);spec.loader.exec_module(history)
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);path='daily_problems/2026/10/1005/problems.md'
            file=root/path;file.parent.mkdir(parents=True)
            original='| 2000 | [CF75D](https://codeforces.com/contest/75/problem/D) | Original |'
            file.write_text(original)
            previous=module.build(root)
            file.write_text(original.replace('2000','2100').replace('Original','Updated'))
            changes=history.inspect(root,previous,[path,path],module.parse,module.enrich,{},'2026-10-07')
            self.assertEqual(len(changes),1)
            self.assertEqual(changes[0]['after'][0]['rating'],2100)
            self.assertEqual(module.build(root,{},previous,today='2026-10-07')['problems'],previous['problems'])
            previous['historicalChanges']=changes
            repeated=history.inspect(root,previous,[path],module.parse,module.enrich,{},'2026-10-07')
            self.assertEqual(repeated,changes)
            with self.assertRaises(ValueError):history.approve(previous,'outdated-id')
            approved=history.approve(previous,changes[0]['id'])
            self.assertEqual(approved['problems'][0]['rating'],2100)
            self.assertEqual(approved['historicalChanges'],[])
            self.assertEqual(previous['problems'][0]['rating'],2000)
            self.assertEqual(module.build(root,{},approved,today='2026-10-07')['problems'],approved['problems'])
            file.write_text(original)
            self.assertEqual(history.inspect(root,previous,[path],module.parse,module.enrich,{},'2026-10-07'),[])
            file.unlink()
            deleted=history.inspect(root,previous,[path],module.parse,module.enrich,{},'2026-10-07')
            self.assertEqual(deleted[0]['after'],[])
            file.write_text('unsupported upstream format')
            invalid=history.inspect(root,previous,[path],module.parse,module.enrich,{},'2026-10-07')
            previous['historicalChanges']=invalid
            with self.assertRaises(ValueError):history.approve(previous,invalid[0]['id'])

    def test_history_survives_edits_deletions_and_metadata_changes(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            old=root/'daily_problems/2026/10/1005/problems.md'
            old.parent.mkdir(parents=True)
            row='| 2000 | [CF75D](https://codeforces.com/contest/75/problem/D) | Original |'
            old.write_text(row)
            categories=root/'categories';categories.mkdir()
            (categories/'DP.md').write_text(row)
            (categories/'trees.md').write_text(row)
            previous=module.build(root)
            old.write_text('Upstream historical file is now invalid')
            new=root/'daily_problems/2026/10/1007/problems.md'
            new.parent.mkdir(parents=True);new.write_text(row)
            new_row='| 1500 | [CF1A](https://codeforces.com/contest/1/problem/A) | New |'
            (categories/'DP.md').write_text(new_row)
            (categories/'trees.md').unlink()
            data=module.build(root,{'75:D':{'rating':3000,'name':'Changed'}},previous,today='2026-10-07')
            historical=[p for p in data['problems'] if p['date']=='2026-10-05']
            self.assertEqual(historical,previous['problems'])
            self.assertEqual(data['days'],2)
            tracks={t['id']:t for t in data['tracks']}
            self.assertEqual({p['key'] for p in tracks['DP']['problems']},{'cf:75:D','cf:1:A'})
            self.assertEqual(tracks['trees']['problems'][0]['dates'],['2026-10-05','2026-10-07'])
            old.unlink()
            again=module.build(root,{},data,today='2026-10-08')
            self.assertEqual(again['problems'],data['problems'])

    def test_current_day_can_finish_updating_without_removing_appearances(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);file=root/'daily_problems/2026/10/1007/problems.md'
            file.parent.mkdir(parents=True)
            row='| 2000 | [CF75D](https://codeforces.com/contest/75/problem/D) | Hint |'
            file.write_text(row)
            previous=module.build(root)
            file.write_text(row.replace('2000','2100')+'\n| 1500 | [CF1A](https://codeforces.com/contest/1/problem/A) | New |')
            data=module.build(root,{},previous,today='2026-10-07')
            self.assertEqual(len(data['problems']),2)
            self.assertEqual(next(p for p in data['problems'] if p['key']=='cf:75:D')['rating'],2100)
            file.write_text(row)
            self.assertEqual(len(module.build(root,{},data,today='2026-10-07')['problems']),2)

class SheepCupTests(unittest.TestCase):
    def test_round_links_and_tutorial_expansion(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            (root/'SheepCup/Round1').mkdir(parents=True)
            round2=root/'SheepCup/Round2';(round2/'standard_solution').mkdir(parents=True)
            (round2/'tutorial.md').write_text('|**A**|**题面标题**|10|\n### 中等偏易题\n#### A. 题解标题？\n说明\n### 较易题\n#### C. 是毛毛虫吗？')
            (root/'SheepCup/Round3').mkdir()
            rounds=module.build_sheep(root)
            self.assertEqual(rounds[0]['accessCode'],'6u8k')
            self.assertEqual(rounds[0]['contestUrl'],'https://www.luogu.com.cn/contest/222636')
            self.assertEqual(len(rounds[0]['problems']),6)
            self.assertEqual(rounds[0]['problems'][0]['title'],'很有操作')
            self.assertIsNone(rounds[0]['problems'][0]['url'])
            self.assertIsNone(rounds[0]['problems'][0]['editorial'])
            self.assertEqual(len(rounds[1]['problems']),2)
            problem=rounds[1]['problems'][0]
            self.assertEqual(problem['title'],'题面标题')
            self.assertEqual(problem['difficulty'],'中等偏易题')
            self.assertEqual(problem['url'],'https://ac.nowcoder.com/acm/contest/100672/A')
            self.assertTrue(problem['editorial'].endswith('#a-%E9%A2%98%E8%A7%A3%E6%A0%87%E9%A2%98'))
            self.assertTrue(rounds[1]['standardSolution'].endswith('Round2/standard_solution'))
            self.assertEqual(rounds[2]['title'],'小羊杯 Round 3')
            self.assertNotIn('contestUrl',rounds[2])
