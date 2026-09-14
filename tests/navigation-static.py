"""Validate built navigation and reading paths without launching a browser.

Run after building: python tests/navigation-static.py [--base /portfolio/]
"""
import argparse
from collections import Counter
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit


@dataclass
class Element:
    tag: str
    attrs: dict
    children: list = field(default_factory=list)

    def descendants(self):
        for child in self.children:
            if isinstance(child, Element):
                yield child
                yield from child.descendants()

    def text(self):
        return ''.join(c.text() if isinstance(c, Element) else c for c in self.children).strip()


class Page(HTMLParser):
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Element('document', {})
        self.stack = [self.root]
        self.feed(source)
        self.nodes = list(self.root.descendants())
        self.ids = [n.attrs['id'] for n in self.nodes if 'id' in n.attrs]
        self.links = [n.attrs['href'] for n in self.nodes if n.tag == 'a' and 'href' in n.attrs]

    def handle_starttag(self, tag, attrs):
        node = Element(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='/')
    parser.add_argument('--directory', default='dist')
    args = parser.parse_args()
    base = '/' + args.base.strip('/') + '/' if args.base.strip('/') else '/'
    root = Path(args.directory).resolve()
    pages = {}
    for file in root.rglob('*.html'):
        relative = file.relative_to(root).as_posix()
        route = base + (relative[:-10] if relative.endswith('index.html') else relative)
        pages[route] = Page(file.read_text(encoding='utf-8'))

    errors = []
    checks = 0

    def check(condition, message):
        nonlocal checks
        checks += 1
        if not condition:
            errors.append(message)

    def has_link(route, target):
        check(route in pages and target in pages[route].links, f'{route} must link to {target}')

    expected_nav = [('', '足迹'), ('projects/', '项目'), ('blog/', '笔记'), ('now/', 'Now'), ('lab/', 'Lab'), ('toolbox/', '工具箱'), ('#contact', '联系我')]
    for route, page in pages.items():
        duplicates = [key for key, count in Counter(page.ids).items() if count > 1]
        check(not duplicates, f'{route}: duplicate IDs: {duplicates}')
        for node in page.nodes:
            if node.tag == 'link' and node.attrs.get('rel') == 'canonical':
                continue
            for attribute in ('href', 'src'):
                if attribute not in node.attrs:
                    continue
                target = urlsplit(urljoin('https://ymchen.me' + route, node.attrs[attribute]))
                check(target.scheme in {'https', 'http', 'mailto', 'tel'}, f'{route}: unsafe URL {node.attrs[attribute]}')
                if target.netloc != 'ymchen.me' or target.scheme not in {'http', 'https'}:
                    continue
                check(target.path.startswith(base), f'{route}: URL escapes base path: {target.path}')
                if not target.path.startswith(base):
                    continue
                relative = unquote(target.path[len(base):])
                file = (root / relative).resolve()
                check(file.is_relative_to(root), f'{route}: URL escapes output directory')
                if not file.is_relative_to(root):
                    continue
                if file.is_dir():
                    file /= 'index.html'
                check(file.is_file(), f'{route}: missing target {target.path}')
                if target.fragment and target.path in pages:
                    check(unquote(target.fragment) in pages[target.path].ids, f'{route}: missing anchor {target.path}#{target.fragment}')

        if route == base + 'research/':
            redirect = [n for n in page.nodes if n.tag == 'meta' and n.attrs.get('http-equiv', '').lower() == 'refresh']
            check(bool(redirect) and base + 'projects/research/' in redirect[0].attrs.get('content', ''), 'Legacy research route must redirect to its project')
            continue

        navs = [n for n in page.nodes if n.tag == 'nav' and n.attrs.get('aria-label') == '主导航']
        check(len(navs) == 2, f'{route}: desktop and mobile menus missing')
        for nav in navs:
            links = [n for n in nav.descendants() if n.tag == 'a']
            actual = [(n.attrs.get('href'), n.text().replace('↗', '').strip()) for n in links]
            check(actual == [(base + p, label) for p, label in expected_nav], f'{route}: unexpected menu {actual}')
            section = route[len(base):].split('/')[0]
            active = 'projects' if section in {'projects', 'resume', 'sources'} else section
            current = [n.attrs.get('href') for n in links if n.attrs.get('aria-current') == 'page']
            expected = [] if section == '404.html' else [base + (active + '/' if active else '')]
            check(current == expected, f'{route}: incorrect current page {current}')
        mobile = [n for n in page.nodes if n.tag == 'details' and n.attrs.get('class') == 'mobile-navigation']
        check(len(mobile) == 1 and any(n.tag == 'summary' for n in mobile[0].descendants()), f'{route}: mobile menu must work without JavaScript')

    home = pages[base]
    chapters = [n.attrs.get('id') for n in home.nodes if 'data-chapter' in n.attrs]
    check(chapters == ['first-frame', 'first-code', 'simulation', 'real-world', 'systems', 'coding', 'review', 'sharing'], 'The eight original footprint chapters must remain in order')
    check(sum('data-journey-visual' in n.attrs for n in home.nodes) == 7, 'The seven footprint animations must remain')
    for route in (base, base + 'lab/'):
        check(pages[route].ids.count('scene') == 1 and pages[route].ids.count('fluid-dialog') == 1, f'{route}: shared fluid experiment or dialog missing')
    paths = [
        ('coding', 'ai-coding', 'completion-latency'),
        ('review', 'code-review', 'review-metrics'),
        ('systems', 'game-tools', 'algorithm-and-workflow'),
    ]
    for chapter, project, note in paths:
        has_link(base, base + f'projects/{project}/')
        has_link(base + f'projects/{project}/', base + f'blog/{note}/')
        has_link(base + f'blog/{note}/', base + f'projects/{project}/')
        has_link(base + f'blog/{note}/', base + f'#{chapter}')
        has_link(base + f'projects/{project}/', base + f'#{chapter}')
    has_link(base + 'lab/', base + '#simulation')
    has_link(base + 'lab/', base + 'projects/research/')
    has_link(base + 'projects/research/', base + 'lab/')
    for project in ('lspf', 'banshu'):
        has_link(base + 'now/', base + f'projects/{project}/')
        has_link(base + f'projects/{project}/', base + f'now/#{project}')
    now = pages[base + 'now/']
    for activity in ('lspf', 'banshu', 'lbm-rust', 'bevy'):
        check(activity in now.ids, f'Now is missing {activity}')
    check(any(n.tag == 'time' and n.attrs.get('datetime') == '2026-09-11' for n in now.nodes), 'Now must use the author-provided update date')
    check('清单还在整理' in pages[base + 'toolbox/'].root.text(), 'Toolbox must not invent recommendations')
    if errors:
        raise SystemExit('\n'.join(errors))
    print(f'PASS: {len(pages)} pages, {checks} static assertions; links, assets, anchors, menus, reading paths and footprint structure. Base: {base}')


if __name__ == '__main__':
    main()
