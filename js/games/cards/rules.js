// Illustrated rules of the card games for people who have never played cards: real mini cards
// ordered by strength with their points, coloured suits, numbered steps and examples.
// The rules are long prose, so each text is written in both languages right here (L(en, bg)).
import { lang } from '../../i18n.js';
import { cardEl } from './cards.js';
import { suitSvg, isRed } from './suits.js';

const L = (en, bg) => (lang === 'bg' ? bg : en);
const SUIT = {
  C: () => L('Clubs', 'Спатия'), D: () => L('Diamonds', 'Каро'), H: () => L('Hearts', 'Купа'), S: () => L('Spades', 'Пика'),
};
const chip = (s) => `<span class="suit-chip ${isRed(s) ? 'red' : 'black'}">${suitSvg(s)}${SUIT[s]()}</span>`;
const mini = (r, s) => cardEl({ r, s, id: r + s }, { cls: 'mini' }).outerHTML;
const row = (cards, notes = []) => `<div class="rules-cards">${cards.map(([r, s], i) => `<figure>${mini(r, s)}${notes[i] != null ? `<figcaption>${notes[i]}</figcaption>` : ''}</figure>`).join('')}</div>`;
const ladder = (title, cards, notes) => `<div class="rules-ladder"><div class="rules-ladder-h"><span>${title}</span><small>${L('strongest → weakest', 'най-силна → най-слаба')}</small></div>${row(cards, notes)}</div>`;
const steps = (items) => `<ol class="rules-steps">${items.map((x) => `<li>${x}</li>`).join('')}</ol>`;
const box = (tone, html) => `<div class="rules-box ${tone}">${html}</div>`;
const suitsIntro = () => `<div class="rules-suits">${['H', 'D', 'S', 'C'].map(chip).join('')}</div>
  <p class="muted">${L('<b>Hearts</b> and <b>Diamonds</b> are red, <b>Spades</b> and <b>Clubs</b> are black. Point at any card during the game to see its name.', '<b>Купа</b> и <b>каро</b> са червени, <b>пика</b> и <b>спатия</b> са черни. По време на игра посочете която и да е карта, за да видите името ѝ.')}</p>`;
const pts = (n) => (n ? `${n} ${L('pts', 'т.')}` : '0');

export function belotRules() {
  return `
  <p class="rules-lead">${L('Belot is played by <b>4 players in 2 teams</b>: you and the player opposite you against the other two. The first team to reach <b>151 points</b> wins.', 'Белотът се играе от <b>4 играчи в 2 отбора</b>: вие и играчът срещу вас срещу другите двама. Печели отборът, който пръв стигне <b>151 точки</b>.')}</p>

  <h3>${L('1. The cards', '1. Картите')}</h3>
  <p>${L('32 cards: 7, 8, 9, 10, jack, queen, king and ace in four suits:', '32 карти: 7, 8, 9, 10, вале, дама, поп и асо в четири бои:')}</p>
  ${suitsIntro()}
  ${row([['J', 'H'], ['Q', 'S'], ['K', 'D'], ['A', 'C']], [L('Jack', 'Вале'), L('Queen', 'Дама'), L('King', 'Поп'), L('Ace', 'Асо')])}

  <h3>${L('2. How a deal goes', '2. Как протича едно раздаване')}</h3>
  ${steps([
    L('Everyone gets <b>5 cards</b>.', 'Всеки получава <b>5 карти</b>.'),
    L('<b>Bidding</b>: in turn, each player can name the suit that will be <b>trumps</b> (the strongest suit), or pass. A later bid must be higher.', '<b>Обявяване</b>: всеки по ред може да назове боята, която ще е <b>коз</b> (най-силната боя), или да каже „пас“. Следващата обява трябва да е по-висока.'),
    L('Everyone gets <b>3 more cards</b> – 8 in total.', 'Всеки получава още <b>3 карти</b> – общо 8.'),
    L('<b>8 tricks</b> are played: each player plays one card, and the strongest card takes all four.', 'Играят се <b>8 ръце</b>: всеки слага по една карта, а най-силната карта взема и четирите.'),
    L('The points of the cards taken are counted, and the next deal begins.', 'Броят се точките на взетите карти и започва ново раздаване.'),
  ])}

  <h3>${L('3. Bidding – from the lowest to the highest', '3. Обявяване – от най-ниската към най-високата')}</h3>
  <div class="rules-bids">${['C', 'D', 'H', 'S'].map(chip).join('<span>‹</span>')}<span>‹</span><span class="bid-chip">${L('No trumps', 'Без коз')}</span><span>‹</span><span class="bid-chip">${L('All trumps', 'Всичко коз')}</span></div>
  <ul>
    <li>${L('<b>A suit</b> (e.g. Hearts): that suit is trumps and beats all others.', '<b>Боя</b> (напр. купа): тази боя е коз и бие всички останали.')}</li>
    <li>${L('<b>No trumps</b>: there are no trumps; the ace is the strongest in each suit.', '<b>Без коз</b>: няма коз; асото е най-силно във всяка боя.')}</li>
    <li>${L('<b>All trumps</b>: every suit is trumps; the jack and the nine are the strongest.', '<b>Всичко коз</b>: всяка боя е коз; валето и деветката са най-силни.')}</li>
    <li>${L('<b>Double</b> (×2) and <b>Redouble</b> (×4) multiply the points. After three passes in a row the bidding ends; if all four pass – the cards are dealt again.', '<b>Контра</b> (×2) и <b>реконтра</b> (×4) умножават точките. След три паса подред обявяването спира; ако и четиримата пасуват – раздава се отново.')}</li>
  </ul>
  ${box('tip', L('💡 With help for beginners on, the game suggests a bid for your cards and explains every button.', '💡 С включена помощ за начинаещи играта ви съветва какво да обявите и обяснява всеки бутон.'))}

  <h3>${L('4. Which card is stronger – and how many points it brings', '4. Коя карта е по-силна – и колко точки носи')}</h3>
  ${ladder(`★ ${L('Trumps', 'Коз')}`, [['J', 'H'], ['9', 'H'], ['A', 'H'], ['10', 'H'], ['K', 'H'], ['Q', 'H'], ['8', 'H'], ['7', 'H']], [20, 14, 11, 10, 4, 3, 0, 0].map(pts))}
  ${ladder(L('Not trumps', 'Не е коз'), [['A', 'S'], ['10', 'S'], ['K', 'S'], ['Q', 'S'], ['J', 'S'], ['9', 'S'], ['8', 'S'], ['7', 'S']], [11, 10, 4, 3, 2, 0, 0, 0].map(pts))}
  <p class="muted">${L('In trumps the <b>jack</b> and the <b>nine</b> jump to the top. A trump beats any card of another suit, even an ace.', 'При коза <b>валето</b> и <b>деветката</b> стават най-силни. Коз бие всяка карта от друга боя – дори асо.')}</p>

  <h3>${L('5. Which card you may play', '5. Каква карта може да изиграете')}</h3>
  ${box('ok', L('<b>1. Follow suit.</b> If a <b>Hearts</b> card is led and you have Hearts, you must play Hearts.', '<b>1. Отговорете на боята.</b> Ако е изиграна <b>купа</b> и имате купа, трябва да сложите купа.'))}
  ${row([['10', 'H'], ['K', 'H']], [L('led', 'изиграна'), L('✔ you follow', '✔ отговаряте')])}
  ${box('ok', L('<b>2. No such suit? Trump.</b> If you have no cards of the suit led, you must play a trump – unless your partner is already winning the trick.', '<b>2. Нямате такава боя? Цакайте.</b> Ако нямате от изиграната боя, трябва да сложите коз – освен ако партньорът ви вече взема ръката.'))}
  ${box('ok', L('<b>3. In trumps – go higher.</b> When trumps are played you must put a higher trump if you have one.', '<b>3. При коз – качвайте.</b> Когато се играе коз, трябва да сложите по-силен коз, ако имате.'))}
  ${box('tip', L('💡 The cards you can\'t play are dimmed. Tap one to see why, or press <b>Hint</b> to see a good move.', '💡 Картите, които не може да играете, са потъмнени. Натиснете някоя, за да видите защо, или <b>Подсказка</b> за добър ход.'))}

  <h3>${L('6. Declarations – bonus points', '6. Анонси – бонус точки')}</h3>
  <p>${L('In the first trick the game finds them automatically:', 'В първата ръка играта ги открива сама:')}</p>
  <div class="rules-decl">
    <div>${row([['7', 'D'], ['8', 'D'], ['9', 'D']])}<b>${L('Tierce', 'Терца')}</b> · 20 ${L('pts', 'т.')}<small>${L('3 in a row, same suit', '3 поредни от една боя')}</small></div>
    <div>${row([['10', 'S'], ['J', 'S'], ['Q', 'S'], ['K', 'S']])}<b>${L('Quarte', 'Кварта')}</b> · 50 ${L('pts', 'т.')}<small>${L('4 in a row', '4 поредни')}</small></div>
    <div><b>${L('Quint', 'Квинта')}</b> · 100 ${L('pts', 'т.')}<small>${L('5 in a row', '5 поредни')}</small></div>
    <div>${row([['J', 'C'], ['J', 'D'], ['J', 'H'], ['J', 'S']])}<b>${L('Four jacks', 'Каре валета')}</b> · 200 ${L('pts', 'т.')}<small>${L('four nines – 150, other fours (10, Q, K, A) – 100', 'каре деветки – 150, други карета (10, Д, П, А) – 100')}</small></div>
    <div>${row([['Q', 'H'], ['K', 'H']])}<b>${L('Belot', 'Белот')}</b> · 20 ${L('pts', 'т.')}<small>${L('queen + king of trumps', 'дама + поп коз')}</small></div>
  </div>

  <h3>${L('7. Counting', '7. Броене на точките')}</h3>
  <ul>
    <li>${L('The points of all cards taken + declarations. The <b>last trick</b> brings +10, all 8 tricks (<b>capot</b>) – +90.', 'Точките на всички взети карти + анонсите. <b>Последната ръка</b> носи +10, всичките 8 ръце (<b>капо</b>) – +90.')}</li>
    <li>${L('If the team that set the trumps scores fewer points than the others, it is <b>"inside"</b> – and all points go to the opponents.', 'Ако отборът, обявил коза, има по-малко точки от другите, той е <b>„вътре“</b> – и всички точки отиват при противника.')}</li>
    <li>${L('On a tie the points <b>"hang"</b> and go to the winner of the next deal.', 'При равенство точките <b>„висят“</b> и отиват при победителя в следващото раздаване.')}</li>
  </ul>`;
}

export function santaseRules() {
  return `
  <p class="rules-lead">${L('Santase (Sixty-six) is for <b>2 players</b>. In every deal you try to collect <b>66 points</b> first; the match is to <b>11 match points</b>.', 'Сантасето (Шейсет и шест) е за <b>2 играчи</b>. Във всяко раздаване се опитвате пръв да съберете <b>66 точки</b>; мачът е до <b>11 точки</b>.')}</p>
  <h3>${L('1. The cards', '1. Картите')}</h3>
  <p>${L('24 cards: 9, jack, queen, king, 10 and ace in four suits:', '24 карти: 9, вале, дама, поп, 10 и асо в четири бои:')}</p>
  ${suitsIntro()}
  ${ladder(L('Strength and points', 'Сила и точки'), [['A', 'S'], ['10', 'S'], ['K', 'S'], ['Q', 'S'], ['J', 'S'], ['9', 'S']], [11, 10, 4, 3, 2, 0].map(pts))}
  <h3>${L('2. How it goes', '2. Как се играе')}</h3>
  ${steps([
    L('Each player gets 6 cards. One card is turned face up – its suit is <b>trumps</b>.', 'Всеки получава по 6 карти. Една карта се обръща – нейната боя е <b>коз</b>.'),
    L('One player leads a card, the other answers. The stronger card takes both. <b>A trump beats any other suit.</b>', 'Единият играч изиграва карта, другият отговаря. По-силната карта взема и двете. <b>Коз бие всяка друга боя.</b>'),
    L('After each trick both draw a card from the stock – the winner first.', 'След всяка ръка двамата теглят по карта от тестето – първо печелившият.'),
    L('While there is a stock you <b>don\'t have to</b> follow suit. When the stock is gone (or closed) you must follow suit, go higher and trump.', 'Докато има тесте, <b>не сте длъжни</b> да отговаряте на боята. Когато тестето свърши (или се затвори), трябва да отговаряте, да качвате и да цакате.'),
  ])}
  <h3>${L('3. Twenty and forty', '3. Двайсет и четирийсет')}</h3>
  <div class="rules-decl">
    <div>${row([['Q', 'D'], ['K', 'D']])}<b>${L('Twenty', 'Двайсет')}</b> · 20 ${L('pts', 'т.')}<small>${L('queen + king of the same suit', 'дама + поп от една боя')}</small></div>
    <div>${row([['Q', 'H'], ['K', 'H']])}<b>${L('Forty', 'Четирийсет')}</b> · 40 ${L('pts', 'т.')}<small>${L('queen + king of trumps', 'дама + поп коз')}</small></div>
  </div>
  <p class="muted">${L('Declare them on your turn by playing one of the pair. They count once you have won a trick.', 'Обявяват се, когато сте на ход, като изиграете едната от двете карти. Зачитат се, след като сте взели ръка.')}</p>
  <h3>${L('4. Special moves', '4. Специални ходове')}</h3>
  <ul>
    <li>${L('<b>Exchange the 9:</b> the nine of trumps can be swapped for the face-up trump.', '<b>Смяна на 9-ката:</b> деветката коз може да се смени с обърнатия коз.')}</li>
    <li>${L('<b>Close:</b> if you think you can reach 66, close the stock – strict rules apply from then on.', '<b>Затваряне:</b> ако мислите, че ще стигнете 66, затворете тестето – оттам нататък важат строгите правила.')}</li>
  </ul>
  <h3>${L('5. Match points', '5. Точки за мача')}</h3>
  <ul>
    <li>${L('3 points if the opponent has no trick, 2 if they have fewer than 33 points, otherwise 1.', '3 точки, ако противникът няма взета ръка, 2 – ако има под 33 точки, иначе 1.')}</li>
    <li>${L('If the player who closed doesn\'t reach 66, the opponent gets 3.', 'Ако затворилият не стигне 66, противникът взема 3.')}</li>
  </ul>
  ${box('tip', L('💡 Point at a card to see its name, whether it\'s a trump, its points and whether you can play it.', '💡 Посочете карта, за да видите името ѝ, дали е коз, колко точки носи и дали може да я изиграете.'))}`;
}

export function blatoRules() {
  return `
  <p class="rules-lead">${L('Blato (3-5-8) is for <b>3 players</b> with a full deck of 52 cards. Each player must take a certain number of tricks.', 'Блато (3-5-8) е за <b>3 играчи</b> с пълно тесте от 52 карти. Всеки трябва да вземе определен брой ръце.')}</p>
  <h3>${L('1. The cards', '1. Картите')}</h3>
  ${suitsIntro()}
  ${ladder(L('Strength in each suit', 'Сила във всяка боя'), [['A', 'C'], ['K', 'C'], ['Q', 'C'], ['J', 'C'], ['10', 'C'], ['9', 'C'], ['2', 'C']], ['', '', '', '', '', '…', ''])}
  <h3>${L('2. The goal', '2. Целта')}</h3>
  <div class="rules-targets"><span class="t8">8</span><span class="t5">5</span><span class="t3">3</span></div>
  <p>${L('The dealer must take <b>8</b> tricks, the next player <b>5</b>, the third <b>3</b>. Every trick above the goal is +1, every trick below is −1.', 'Раздаващият трябва да вземе <b>8</b> ръце, следващият – <b>5</b>, третият – <b>3</b>. Всяка ръка над целта е +1, всяка под целта е −1.')}</p>
  <h3>${L('3. How it goes', '3. Как се играе')}</h3>
  ${steps([
    L('Everyone gets 16 cards; 4 stay in the middle – the <b>swamp</b>.', 'Всеки получава по 16 карти; 4 остават в средата – <b>блатото</b>.'),
    L('The dealer takes the swamp, chooses the <b>trumps</b> and discards 4 cards.', 'Раздаващият взема блатото, избира <b>коз</b> и сваля 4 карти.'),
    L('You must follow suit. If you can\'t, play any card – you don\'t have to trump.', 'Трябва да отговорите на боята. Ако нямате – играете каквото искате; не сте длъжни да цакате.'),
    L('The highest trump takes the trick; without trumps – the highest card of the suit led.', 'Ръката взема най-високият коз; ако няма коз – най-високата карта от изиграната боя.'),
  ])}
  <h3>${L('4. Exchange', '4. Размяна')}</h3>
  <p>${L('In the next deal the players who took more than their goal give cards to those who fell short, and get back their strongest card of the same suit.', 'В следващото раздаване играчите, взели повече от целта си, дават карти на изостаналите и получават обратно най-силната им карта от същата боя.')}</p>
  ${box('tip', L('💡 Point at a card to see its name and whether you can play it.', '💡 Посочете карта, за да видите името ѝ и дали може да я изиграете.'))}`;
}
