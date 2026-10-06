import importlib.util,tempfile,unittest
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
        self.assertEqual(metadata.classify('Codeforces Global Round 8'),['div1','div2','div12'])
        self.assertEqual(metadata.classify('Codeforces Round 993 (Div. 4)'),['div4'])
        self.assertEqual(metadata.classify('2018-2019 ICPC, NEERC, Northern Eurasia Finals (Online Mirror)'),['icpc'])
        self.assertEqual(metadata.classify('Codeforces Beta Round (ACM-ICPC Rules)'),['other'])
        self.assertEqual(metadata.classify('Codeforces Round (Div. 1 + Div. 2)'),['div1','div2','div12'])
