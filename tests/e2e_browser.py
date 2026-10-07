"""
Browser end-to-end test (Chromium via Playwright) against a running LMS + mock AI.
Usage: python3 tests/e2e_browser.py <base_url> <screenshot_dir>
Prints one line per check: PASS/FAIL <name>.
"""
import json, sys, urllib.request
from playwright.sync_api import sync_playwright

BASE, SHOTS = sys.argv[1], sys.argv[2]
PW_I, PW_L = 'VJ%NTj+R%zgvTp3wmc', '7rcV%5qXmNTFttj_Dw'
CID, LID = 'c_ai_fluency', 'af-d1'
results = []

def check(name, cond, detail=''):
    results.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  ({detail})' if detail and not cond else ''), flush=True)

def api(path, token=None, body=None, method=None):
    req = urllib.request.Request(BASE + '/api' + path, method=method or ('POST' if body is not None else 'GET'))
    if token: req.add_header('Authorization', 'Bearer ' + token)
    data = None
    if body is not None:
        req.add_header('Content-Type', 'application/json'); data = json.dumps(body).encode()
    with urllib.request.urlopen(req, data) as r: return json.loads(r.read())

def upload(token, path, name, mime):
    import uuid
    b = uuid.uuid4().hex
    body = (f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n').encode() + open(path, 'rb').read() + f'\r\n--{b}--\r\n'.encode()
    req = urllib.request.Request(BASE + '/api/uploads', data=body, method='POST')
    req.add_header('Authorization', 'Bearer ' + token); req.add_header('Content-Type', f'multipart/form-data; boundary={b}')
    with urllib.request.urlopen(req) as r: return json.loads(r.read())['url']

# ---- Setup through the API: video with a timed transcript, rich instructions, rubric PDF, publish ----
ti = api('/auth/login', body={'email': 'instructor@usaii.org', 'password': PW_I})['token']
tl = api('/auth/login', body={'email': 'alex.rivera@enterprise.com', 'password': PW_L})['token']
video = upload(ti, '/tmp/test-video.webm', 'worked-example.webm', 'video/webm')
img = upload(ti, '/tmp/instr.png', 'example.png', 'image/png')
pdf = upload(ti, '/tmp/rubric.pdf', 'Day 1 Rubric.pdf', 'application/pdf')
course = api(f'/staff/courses/{CID}', ti)['course']
lesson = course['modules'][0]['lessons'][0]
vb = next(b for b in lesson['blocks'] if b['type'] == 'video')
vb['url'], vb['label'] = video, 'Worked example: Dana sorts her morning'
vb['transcript'] = '\n'.join(f'[0:{s:02d}] Line {i+1}: Dana looks at task {i+1} and decides whether AI fits it.' for i, s in enumerate(range(0, 20, 2)))
lesson['activity']['instructionBlocks'] = [
    {'id': 'i1', 'type': 'paragraph', 'text': 'List five to eight tasks you did at work last week. Write them plainly, one line each.'},
    {'id': 'i2', 'type': 'image', 'url': img, 'label': 'Example task list', 'text': 'An example of a sorted task list'},
    {'id': 'i3', 'type': 'list', 'items': ['Mark each task "AI helps" or "do it myself".', 'Circle the one you will use this week.'], 'ordered': False},
]
lesson['activity']['rubricPdf'] = {'url': pdf, 'name': 'Day 1 Rubric.pdf', 'maxPoints': 20}
course['price'], course['priceSet'] = 0, True
api(f'/staff/courses/{CID}', ti, course, 'PUT')
api(f'/staff/courses/{CID}/status', ti, {'status': 'published'})
api(f'/learner/enroll/{CID}', tl, {})

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1440, 'height': 950}, locale='hi-IN')
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))

    # ---- Sign-in page: no credentials shown ----
    page.goto(BASE + '/'); page.wait_for_selector('#email')
    body = page.inner_text('body')
    check('Sign-in page shows no test credentials', 'Fill It In' not in body and PW_L not in body and 'Learner@2026' not in body)
    page.screenshot(path=f'{SHOTS}/01-sign-in.png')
    page.fill('#email', 'alex.rivera@enterprise.com'); page.fill('#password', PW_L)
    page.get_by_role('button', name='Sign in as Learner').click()
    page.wait_for_timeout(2500)

    # ---- Lesson video: transcript opens on play ----
    page.goto(f'{BASE}/#/study/{CID}/{LID}'); page.wait_for_selector('video', timeout=20000)
    page.locator('video').scroll_into_view_if_needed()
    check('Transcript panel is closed before playing', page.locator('aside[aria-label="Video transcript"]').count() == 0)
    page.evaluate("document.querySelector('video').muted = true; document.querySelector('video').play()")
    page.wait_for_selector('aside[aria-label="Video transcript"]', timeout=8000)
    check('Transcript panel opens when the video plays', True)
    box_v = page.locator('video').bounding_box(); box_p = page.locator('aside[aria-label="Video transcript"]').bounding_box()
    check('Panel sits to the right of the video', box_p['x'] > box_v['x'] + box_v['width'] - 5, f'{box_v} {box_p}')
    page.wait_for_timeout(3200)
    active = page.locator('aside[aria-label="Video transcript"] li button[aria-current="true"]')
    check('Spoken line is highlighted while playing', active.count() == 1 and 'Line' in active.inner_text())
    page.locator('aside[aria-label="Video transcript"]').screenshot(path=f'{SHOTS}/02-transcript-panel.png')
    page.screenshot(path=f'{SHOTS}/03-lesson-video-with-transcript.png')

    # ---- Click a line to jump ----
    page.locator('aside[aria-label="Video transcript"] li button', has_text='Line 8').click(); page.wait_for_timeout(600)
    t = page.evaluate("document.querySelector('video').currentTime")
    check('Clicking a line jumps the video there', 14 <= t <= 16.5, f't={t}')

    # ---- Language search ----
    page.locator('aside[aria-label="Video transcript"] button[aria-haspopup="listbox"]').click()
    page.wait_for_selector('input[aria-label="Search languages"]')
    check('Browser language (Hindi) is suggested first', 'Hindi' in page.locator('[role=listbox]').inner_text().split('Languages of India')[0])
    page.screenshot(path=f'{SHOTS}/04-language-list.png')
    page.fill('input[aria-label="Search languages"]', 'मराठी')
    opts = page.locator('[role=option]')
    check('Search by native script finds Marathi', opts.count() >= 1 and 'Marathi' in opts.first.inner_text())
    page.fill('input[aria-label="Search languages"]', 'tam')
    check('Search by English name finds Tamil', 'Tamil' in opts.first.inner_text())
    page.fill('input[aria-label="Search languages"]', 'hindi')
    page.locator('aside[aria-label="Video transcript"]').screenshot(path=f'{SHOTS}/05-language-search.png')
    page.keyboard.press('Enter')
    page.wait_for_selector('aside[aria-label="Video transcript"] li:has-text("[HI]")', timeout=15000)
    check('Transcript translates into Hindi', page.locator('aside[aria-label="Video transcript"] li').first.inner_text().count('[HI]') == 1)
    check('Translated transcript keeps its timestamps', '0:00' in page.locator('aside[aria-label="Video transcript"] li').first.inner_text())
    page.locator('aside[aria-label="Video transcript"]').screenshot(path=f'{SHOTS}/06-transcript-hindi.png')

    # ---- Close stays closed; button reopens ----
    page.get_by_role('button', name='Close transcript').click()
    page.evaluate("document.querySelector('video').play()"); page.wait_for_timeout(800)
    check('A closed panel does not pop back on play', page.locator('aside[aria-label="Video transcript"]').count() == 0)
    page.get_by_role('button', name='Transcript and translation').click()
    page.wait_for_timeout(600)
    check('Transcript button reopens the panel (language remembered)', page.locator('aside[aria-label="Video transcript"] li:has-text("[HI]")').count() > 0)

    # ---- Mobile: panel stacks under the video ----
    m = browser.new_context(viewport={'width': 390, 'height': 844}, storage_state=ctx.storage_state()).new_page()
    m.goto(f'{BASE}/#/study/{CID}/{LID}'); m.wait_for_selector('video', timeout=20000)
    m.evaluate("document.querySelector('video').muted = true; document.querySelector('video').play()")
    m.wait_for_selector('aside[aria-label="Video transcript"]', timeout=8000)
    bv = m.locator('video').bounding_box(); bp = m.locator('aside[aria-label="Video transcript"]').bounding_box()
    check('On a phone the panel stacks below the video', bp['y'] >= bv['y'] + bv['height'] - 2)
    sw = m.evaluate('document.documentElement.scrollWidth')
    check('No sideways scrolling on a phone', sw <= 392, f'scrollWidth={sw}')
    m.locator('aside[aria-label="Video transcript"]').scroll_into_view_if_needed()
    m.screenshot(path=f'{SHOTS}/07-mobile-transcript.png')

    # ---- Activity: rich instructions, no numbering, rubric link ----
    page.goto(f'{BASE}/#/study/{CID}/{LID}'); page.wait_for_selector('nav[aria-label="Lesson steps"]')
    page.locator('nav[aria-label="Lesson steps"] button', has_text='Apply').click(); page.wait_for_timeout(800)
    card = page.locator('.activity-instructions')
    check('Activity instructions are not a numbered list', card.locator('ol').count() == 0)
    check('Instruction image is shown', card.locator('img[alt="Example task list"]').count() == 1)
    check('Learner can open the rubric PDF', page.get_by_role('link', name='Open rubric (PDF)').count() == 1)
    page.screenshot(path=f'{SHOTS}/08-activity-instructions.png', full_page=False)
    # submit
    page.locator('textarea').first.fill('Weekly status report; supplier follow-up email; meeting notes summary; invoice check.')
    page.get_by_role('button', name='Submit activity').click(); page.wait_for_timeout(1500)
    check('Learner submits the activity', page.get_by_text('Submitted').count() > 0)
    check('No JavaScript errors on learner pages', not errors, '; '.join(errors[:3]))

    # ---- Instructor: Course Builder activity tab ----
    ip = browser.new_context(viewport={'width': 1440, 'height': 1000}).new_page()
    ierr = []; ip.on('pageerror', lambda e: ierr.append(str(e)))
    ip.goto(BASE + '/'); ip.wait_for_selector('#email')
    ip.get_by_role('tab', name='Instructor').click()
    ip.fill('#email', 'instructor@usaii.org'); ip.fill('#password', PW_I)
    ip.get_by_role('button', name='Sign in as Instructor').click(); ip.wait_for_timeout(2500)
    ip.goto(f'{BASE}/#/courses/edit/{CID}'); ip.wait_for_timeout(1500)
    ip.get_by_role('button', name='Next: add lessons').click(); ip.wait_for_timeout(500)
    ip.get_by_role('button', name='Edit').first.click(); ip.wait_for_timeout(800)
    tr = ip.locator('text=Transcript · learners can read it beside the video')
    check('Builder shows transcript tools on the video', tr.count() == 1)
    check('Builder detects timed transcript lines', ip.locator('text=10 timed lines').count() == 1)
    import re
    ip.get_by_role('tab', name=re.compile('^Activity')).click()
    check('Tabs expose role=tab with aria-selected', ip.get_by_role('tab', name=re.compile('^Activity')).get_attribute('aria-selected') == 'true')
    ip.wait_for_timeout(600)
    check('Builder: instructions editor offers Image', ip.locator('button', has_text='Image').count() >= 1)
    check('Builder: rubric is a PDF upload with total points', ip.locator('input[aria-label="Total rubric points"]').input_value() == '20')
    check('Builder: no typed-criteria editor', ip.locator('text=Add criterion').count() == 0)
    ip.screenshot(path=f'{SHOTS}/09-builder-activity.png', full_page=True)

    # ---- Instructor: review against the rubric PDF ----
    ip.goto(f'{BASE}/#/assessments'); ip.wait_for_timeout(2000)
    ip.get_by_role('button', name='View Assessment').first.click(); ip.wait_for_timeout(1500)
    check('Review shows the rubric PDF beside the work', ip.locator('iframe[title^="Rubric"]').count() == 1)
    ip.get_by_role('button', name='Suggest a score from the rubric').click()
    ip.wait_for_selector('text=AI suggestion', timeout=15000)
    ip.get_by_role('button', name='Use this score').click()
    check('AI suggestion fills the points', ip.locator('#rubric-points').input_value() == '14')
    ip.screenshot(path=f'{SHOTS}/10-review-with-rubric-pdf.png')
    ip.get_by_role('button', name='Approve', exact=True).click(); ip.wait_for_timeout(1500)
    sub = api('/staff/submissions', ti)['submissions'][0]['submission']
    check('Approval records 14/20 = 70%', sub['rubric']['points'] == 14 and sub['rubric']['percent'] == 70)
    check('No JavaScript errors on instructor pages', not ierr, '; '.join(ierr[:3]))

    # ---- Learner sees the score and the honest forecast ----
    page.goto(f'{BASE}/#/dashboard'); page.wait_for_timeout(1200)
    page.goto(f'{BASE}/#/study/{CID}/{LID}'); page.wait_for_timeout(1500)
    page.locator('nav[aria-label="Lesson steps"] button', has_text='Apply').click(); page.wait_for_timeout(800)
    check('Learner sees rubric score 14 / 20', page.get_by_text('Your rubric score').count() == 1)
    page.screenshot(path=f'{SHOTS}/11-learner-rubric-score.png')
    page.goto(f'{BASE}/#/dashboard'); page.wait_for_timeout(1500)
    txt = page.inner_text('body')
    check('Forecast states how much evidence backs it', 'Not enough evidence yet' in txt or 'Early estimate' in txt or 'not a guarantee' in txt)
    page.screenshot(path=f'{SHOTS}/12-dashboard-forecast.png')
    browser.close()

fails = [n for n, ok in results if not ok]
print(f'\nRESULT {len(results) - len(fails)}/{len(results)} passed')
json.dump([{'name': n, 'pass': ok} for n, ok in results], open(f'{SHOTS}/e2e-results.json', 'w'), indent=1)
