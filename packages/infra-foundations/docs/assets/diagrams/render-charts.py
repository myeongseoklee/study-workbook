from pathlib import Path
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

out=Path(__file__).resolve().parent
font_path=next((p for p in ['/System/Library/Fonts/AppleSDGothicNeo.ttc','/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'] if Path(p).exists()),None)
if font_path is None:
    raise SystemExit('한글 글꼴 경로를 font_path에 지정한 뒤 다시 실행하세요.')
font_manager.fontManager.addfont(font_path)
plt.rcParams.update({'font.family':font_manager.FontProperties(fname=font_path).get_name(),'font.size':12,'axes.spines.top':False,'axes.spines.right':False,'axes.titleweight':'bold','axes.titlesize':19,'axes.titlepad':20,'figure.facecolor':'#ffffff','axes.facecolor':'#ffffff','savefig.facecolor':'#ffffff','axes.unicode_minus':False})
manifest=[]
def save(slug,title,anchor,caption,fig,ch=15):
    for ext in ['png','svg']:fig.savefig(out/f'{slug}.{ext}',dpi=180,bbox_inches='tight')
    plt.close(fig)
    manifest.append(dict(slug=slug,chapter=ch,title=title,anchor=anchor,caption=caption,type='chart'))

fig,ax=plt.subplots(figsize=(10,4.4),layout='constrained')
names=['입력 검증','DB 연결 풀 대기','DB 질의 실행','응답 만들기']
starts=[0,10,100,140];durations=[10,90,40,10]
for i,(n,start,duration)in enumerate(zip(names,starts,durations)):
    ax.barh(i,duration,left=start,height=.65,color='#c76b26' if i==1 else '#3975ac',zorder=3)
    ax.text(start+duration/2,i,f'{duration} ms',color='white',ha='center',va='center',fontsize=11 if duration>10 else 9)
ax.set(yticks=range(4),yticklabels=names,xlim=(0,150),xticks=range(0,151,10),xlabel='요청 시작 뒤 경과 시간 (ms)')
ax.invert_yaxis();ax.grid(axis='x',alpha=.2);ax.set_title('150 ms 중 90 ms는 질의 전의 연결 풀 대기')
save('15-request-time', '150ms 요청의 시간은 어디에 쓰였을까','### 여러 서버의 작업을 어떻게 한 요청으로 묶을까',
     '본문의 순차 실행 가정(10+90+40+10=150ms)을 같은 시간축에 그렸다. 막대 길이는 실제 비율이다. 포함·병렬 스팬이 있는 실제 추적은 단순 합산하면 안 된다.',fig)

fig,axes=plt.subplots(1,2,figsize=(11,4.5),layout='constrained',gridspec_kw={'width_ratios':[1,1.5]})
axes[0].bar(['100 ms','2,000 ms'],[95,5],color=['#3975ac','#c76b26'],width=.55)
axes[0].set(ylim=(0,100),ylabel='요청 수 (건)',title='100명 중 5명은 2초 대기')
for x,n in enumerate([95,5]):axes[0].text(x,n+2,f'{n}건',ha='center')
values=[195,100,2000]
axes[1].barh(['평균','P95','P99'],values,color=['#3975ac','#3975ac','#c76b26'],height=.55)
axes[1].set(xlim=(0,2250),xlabel='지연 (ms)',title='평균만으로 긴 지연을 알 수 없다')
axes[1].invert_yaxis()
for y,n in enumerate(values):axes[1].text(n+35,y,f'{n:,} ms',va='center')
for ax in axes:ax.grid(axis='y' if ax==axes[0] else 'x',alpha=.15);ax.set_axisbelow(True)
save('15-tail-latency','평균 195ms 속에 2초를 기다린 손님이 있다','### 두 서버의 P95를 평균 내면 전체 P95일까',
     '본문의 95건×100ms, 5건×2,000ms 가정이다. P95·P99는 정렬 후 비율 위치를 올림하는 방식으로 계산했다. 두 그래프 모두 수치축은 0에서 시작한다.',fig)

fig,ax=plt.subplots(figsize=(10,3.6),layout='constrained')
ax.barh(0,300,left=0,height=.45,color='#6753a6')
ax.axvline(120,color='#c76b26',lw=2,ls='--')
ax.text(120,.48,'12:02 원본 주소 변경',ha='center',color='#a54d17')
ax.text(150,0,'리졸버 A가 이미 받은 이전 결과 · TTL 300초',color='white',ha='center',va='center')
ax.scatter([0,300],[0,0],s=70,color='#6753a6',zorder=3)
ax.set(xlim=(-10,330),ylim=(-.6,.9),yticks=[],xticks=[0,60,120,180,240,300],xticklabels=['12:00','12:01','12:02','12:03','12:04','12:05'],xlabel='시각')
ax.text(0,-.4,'저장',ha='center');ax.text(300,-.4,'이전 캐시 만료',ha='center')
ax.set_title('원본을 바꾸어도 이미 받은 캐시의 수명은 남아 있다')
save('03-ttl','DNS 변경 시각과 캐시 만료 시각은 다르다','## 4. 요청의 뜻을 서로 약속해야 한다',
     '본문의 TTL 300초 예다. 12:02에 원본을 고쳐도 A가 12:00에 받은 결과는 12:05까지 유효할 수 있다. 기존 TCP 연결의 수명은 이 막대로 표현하지 않았다.',fig,3)

from matplotlib.patches import Rectangle
fig,ax=plt.subplots(figsize=(10,3.8),layout='constrained')
for row,bits in enumerate(['10000000','10111111']):
    y=1-row
    for i,bit in enumerate(bits):
        ax.add_patch(Rectangle((i,y-.3),.95,.6,facecolor='#3975ac' if i<2 else '#dbe9f4',edgecolor='white'))
        ax.text(i+.475,y,bit,ha='center',va='center',fontsize=19,color='white' if i<2 else '#25394a')
    ax.text(-.25,y,'128' if row==0 else '191',ha='right',va='center',fontsize=15)
ax.text(1,-.8,'고정된 앞 2비트: 10',ha='center',color='#23577e')
ax.text(5,-.8,'변할 수 있는 뒤 6비트',ha='center',color='#23577e')
ax.set(xlim=(-1.3,8),ylim=(-1.05,1.7));ax.axis('off')
ax.set_title('10.0.1.128/26: 앞 24비트 + 마지막 숫자의 앞 2비트 고정')
save('05-cidr','/26의 경계는 마지막 숫자의 중간에 있다','## 2. 서브넷은 나눈 네트워크 대역이다',
     '두 행은 범위의 시작 128과 끝 191의 마지막 8비트다. 앞의 10이 고정되고 뒤 6비트만 바뀌므로 전체 주소 수는 2⁶=64개다. 배정 가능 개수와는 구분한다.',fig,5)

fig,ax=plt.subplots(figsize=(10,4),layout='constrained')
lanes=[('A 요청',[(0,1,'A 계산','#3975ac'),(1,3,'I/O 대기','#c8d0da'),(4,1,'A 마무리','#3975ac')]),('B 요청',[(1,2,'B 계산','#248475')]),('CPU 한 코어',[(0,1,'A','#3975ac'),(1,2,'B','#248475'),(3,1,'다른 일 가능','#e4e8ec'),(4,1,'A','#3975ac')])]
for y,(name,segments)in enumerate(lanes):
    for start,duration,label,color in segments:
        ax.barh(y,duration,left=start,height=.55,color=color,edgecolor='white',linewidth=1)
        ax.text(start+duration/2,y,label,ha='center',va='center',color='white' if color in ['#3975ac','#248475'] else '#293746',fontsize=11)
ax.set(yticks=range(3),yticklabels=[l[0] for l in lanes],xlim=(0,5),xticks=range(6),xlabel='설명용 시간 단위 (실측값 아님)')
ax.invert_yaxis();ax.grid(axis='x',alpha=.18);ax.set_axisbelow(True)
ax.set_title('A가 기다리는 동안 B를 실행해도 CPU 병렬 실행은 아니다')
save('06-concurrency','요청의 대기와 CPU 사용 시간을 나누어 보자','## 4. 스레드는 프로세스 안의 실행 흐름이다',
     '본문의 계산·대기 사례를 단일 코어의 가상 시간표로 풀었다. A가 기다리는 동안 B가 계산한다. 같은 시각에 CPU가 A와 B를 함께 계산한 것은 아니다.',fig,6)

