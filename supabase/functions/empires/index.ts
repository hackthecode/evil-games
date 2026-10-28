// AUTO-GENERATED FILE – do not edit by hand.
// Source: js/games/empires/ and supabase/functions/empires/handler.ts (see tools/build-empires.py).
// @ts-nocheck
/* eslint-disable */
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const __m = {};
__m['js/i18n/tk.js'] = (() => {
// Translatable text for code that also runs on the server (game logic, Supabase Edge Functions).
// tk('English text {0}', arg) returns a compact token; the browser turns it into the player's
// language when it is displayed (see js/i18n.js → decode). Arguments may be tokens themselves.
const T_OPEN = '\u0001', T_SEP = '\u001f', T_CLOSE = '\u0002';

function tk(key, ...args) {
  return T_OPEN + key + args.map((a) => T_SEP + String(a ?? '')).join('') + T_CLOSE;
}

return { T_OPEN, tk };
})();

__m['js/i18n/render.js'] = (() => {
// Renders text with translation tokens (see tk.js) using a dictionary (null = English).
// Pure function – used by the browser (js/i18n.js) and by the server for push notifications.
const { T_OPEN, T_SEP, T_CLOSE } = __m['js/i18n/tk.js'];

const fill = (s, args, dict) => (args.length ? s.replace(/\{(\d+)\}/g, (m, i) => (i < args.length ? render(String(args[i] ?? ''), dict) : m)) : s);

function translate(key, args, dict) {
  return fill((dict && dict[key]) || key, args, dict);
}

function render(s, dict) {
  if (typeof s !== 'string' || !s.includes(T_OPEN)) return s;
  let i = 0;
  function parse(stop) {
    let out = '';
    while (i < s.length) {
      if (s[i] === T_OPEN) {
        i++;
        const parts = [''];
        while (i < s.length && s[i] !== T_CLOSE) {
          if (s[i] === T_OPEN) parts[parts.length - 1] += parse(true);
          else if (s[i] === T_SEP) { parts.push(''); i++; }
          else parts[parts.length - 1] += s[i++];
        }
        i++;
        const [key, ...args] = parts;
        out += translate(key, args, dict);
        if (stop) return out;
        continue;
      }
      out += s[i++];
    }
    return out;
  }
  return parse(false);
}

return { translate, render };
})();

__m['js/i18n/bg.js'] = (() => {
// Bulgarian dictionary: English source string → Bulgarian translation (see js/i18n.js).
// New UI strings: add the English text in the code with t('…') and its translation here.
const BG = {
  '\n      <p>Choose a people – <b>Humans, Undead, Orcs or Witchers</b> – and turn a heap of ashes into an empire of many cities.</p>\n      <ul>\n        <li><b>Resources and buildings:</b> every city produces gold, wood, stone and food (bones for the undead) even when you are not playing. The Citadel limits the levels of the other buildings.</li>\n        <li><b>New cities:</b> with Citadel 5 train settlers and send them to free land on the Map. One more city for every 5 Citadel levels.</li>\n        <li><b>Hero:</b> goes on adventures for experience, resources and items; has skills and equipment, leads the army and defends the city. If they fall – revive them in the Hall of Heroes.</li>\n        <li><b>Marches:</b> raids on barbarian camps, attacks on computer rulers and other players, scouting with scouts, reinforcements. Spears beat cavalry, cavalry beats archers, archers beat spears.</li>\n        <li><b>Tactical battles:</b> when raiding or attacking, choose "Tactical battle" – on arrival you lead the army turn by turn on a hex map (forest, hills, ruins, rivers). You have 1 hour, otherwise the battle is decided automatically.</li>\n        <li><b>Defense:</b> palisade/wall, traps, hideout (protects resources from plunder), watchtower (sees attacks earlier and reveals their makeup), night bonus 0:00–7:00 Bulgarian time (+50% defense). New players are protected for 5 days (it ends if you attack a ruler).</li>\n        <li><b>Morale:</b> if you attack a much weaker ruler, your army hits less hard.</li>\n        <li><b>Oases:</b> defeat the guards with the hero in the army and conquer the oasis (+25% to the resource; up to 3 tiles from the city; Hall of Heroes 3/6/10).</li>\n        <li><b>Alliances:</b> with an Embassy join or found an alliance – chat, reinforcements, diplomacy (alliance, pact, war), rankings. You can buy a pact with the computer clans.</li>\n        <li><b>Science and ages:</b> Ash → Bronze (Citadel 5, Bronze Casting, the barbarian warlord) → Iron (Citadel 10, Iron, camp level 10) – with pikemen, crossbowmen, heavy cavalry, stables and temple.</li>\n      </ul>\n      <p>With an online account the world is shared by all players and the server checks every action. Turn on notifications in the settings (⚙) – they arrive even when the game is closed.</p>': '\n      <p>Изберете народ – <b>Хора, Немъртви, Орки или Вещери</b> – и превърнете едно пепелище в империя от много градове.</p>\n      <ul>\n        <li><b>Ресурси и сгради:</b> всеки град произвежда злато, дърво, камък и храна (при немъртвите – кости) и когато не сте в играта. Цитаделата ограничава нивата на останалите сгради.</li>\n        <li><b>Нови градове:</b> с Цитадела 5 обучете заселници и ги изпратете на свободна земя от Картата. На всеки 5 нива на Цитаделата – още един град.</li>\n        <li><b>Герой:</b> ходи на приключения за опит, ресурси и предмети; има умения и екипировка, води войската и защитава града. Ако падне – съживете го в Залата на героите.</li>\n        <li><b>Походи:</b> набези на варварски лагери, атаки срещу владетелите на компютъра и други играчи, разузнаване със съгледвачи, подкрепления. Копията бият конницата, конницата – стрелците, стрелците – копията.</li>\n        <li><b>Тактически битки:</b> при набег или атака срещу компютъра изберете „Тактическа битка“ – при пристигане водите войската на ходове по шестоъгълна карта (гора, хълмове, руини, реки). Имате 1 час, иначе битката се решава автоматично.</li>\n        <li><b>Защита:</b> палисада/стена, капани, скривалище (пази ресурси от грабеж), стражева кула (вижда нападенията по-рано и разкрива състава им), нощен бонус 0:00–7:00 българско време (+50% защита). Новите играчи са под защита 5 дни (изтича, ако нападнете владетел).</li>\n        <li><b>Морал:</b> ако нападате много по-слаб владетел, войската ви бие по-слабо.</li>\n        <li><b>Оазиси:</b> победете пазачите с героя във войската и завладейте оазиса (+25% към ресурса; до 3 полета от града; Зала на героите 3/6/10).</li>\n        <li><b>Съюзи:</b> с Посолство се присъединете или основете съюз – чат, подкрепления, дипломация (съюз, пакт, война), класации. Срещу клановете на компютъра можете да купите пакт.</li>\n        <li><b>Наука и епохи:</b> Пепелна → Бронзова (Цитадела 5, Бронзолеене, вождът на варварите) → Желязна (Цитадела 10, Желязо, лагер ниво 10) – с пикинери, арбалетчици, тежка конница, конюшня и храм.</li>\n      </ul>\n      <p>С онлайн акаунт светът е общ за всички играчи, а сървърът проверява всяко действие. Включете известията от герба горе вляво – идват и когато играта е затворена.</p>',
  '\n      <p>Each player has 4 pieces in their yard. The goal is to be the first to take them around the whole track and into your home row.</p>\n      <ul>\n        <li>A piece leaves the yard only with a <b>six</b>. With a six, bringing out a piece is mandatory if possible.</li>\n        <li>After a six you roll again.</li>\n        <li>If you have no pieces in play, you get 3 tries to roll a six.</li>\n        <li>If you land on a square with an opposing piece, you "capture" it – it goes back to the yard.</li>\n        <li>You cannot land on a square with your own piece. The start square must be cleared while you have pieces in the yard.</li>\n        <li>You enter the home row with an exact roll and cannot jump over your own pieces.</li>\n      </ul>\n      <p><b>Controls:</b> press "Roll" (or the board), then choose the highlighted piece.</p>': '\n      <p>Всеки играч има 4 пула в кошарата си. Целта е пръв да ги прекарате по целия път и да ги вкарате в домашната си редица.</p>\n      <ul>\n        <li>Пул излиза от кошарата само с <b>шестица</b>. При шестица изкарването на пул е задължително, ако е възможно.</li>\n        <li>След шестица хвърляте отново.</li>\n        <li>Ако нямате пулове в игра, имате 3 опита да хвърлите шестица.</li>\n        <li>Ако спрете на поле с противников пул, го „изяждате“ – той се връща в кошарата.</li>\n        <li>Не можете да спрете на поле със свой пул. Стартовото поле трябва да се освободи, докато имате пулове в кошарата.</li>\n        <li>В домашната редица се влиза с точен брой и не се прескачат собствени пулове.</li>\n      </ul>\n      <p><b>Управление:</b> натиснете „Хвърли“ (или дъската), после изберете подсветения пул.</p>',
  '\n      <p>Each player starts with 15 checkers in opposite corners (white – top right, black – bottom left) and both move <b>in the same direction</b> – counter-clockwise. White\'s home is bottom right, black\'s – top left.</p>\n      <ul>\n        <li><b>No hitting.</b> Even a single checker blocks the point – the opponent cannot land there.</li>\n        <li>Doubles are played 4 times.</li>\n        <li><b>Escalation:</b> from each player\'s 4th roll on, if you roll doubles, you play them and all following doubles up to 6-6 (e.g. 4-4, then 5-5 and 6-6).</li>\n        <li>If you cannot play everything from such doubles (but have played at least one move), the rest is played by the opponent.</li>\n        <li>You bear off when all checkers are home. <b>Gammon</b> (the opponent has not borne off a single checker) – 2 points.</li>\n      </ul>': '\n      <p>Всеки играч започва с 15 пула в противоположни ъгли (белите – горе вдясно, черните – долу вляво) и двамата се движат <b>в една и съща посока</b> – обратно на часовниковата стрелка. Домът на белите е долу вдясно, на черните – горе вляво.</p>\n      <ul>\n        <li><b>Няма биене.</b> Дори единичен пул блокира точката – противникът не може да спре там.</li>\n        <li>Чифтът се играе 4 пъти.</li>\n        <li><b>Ескалация:</b> от 4-тото хвърляне на всеки играч нататък, ако хвърлите чифт, играете него и всички следващи чифтове до 6-6 (напр. 4-4, после 5-5 и 6-6).</li>\n        <li>Ако не можете да изиграете всичко от такъв чифт (но сте изиграли поне един ход), остатъкът се изиграва от противника.</li>\n        <li>Изнасяте, когато всички пулове са в дома. <b>Марс</b> (противникът не е изнесъл нито един пул) – 2 точки.</li>\n      </ul>',
  '\n      <p>Each player starts with all 15 checkers on one point – the farthest from their home – and moves them home, where they bear them off.</p>\n      <ul>\n        <li>Movement is as in regular backgammon: white towards the bottom right corner, black – mirrored.</li>\n        <li><b>No hitting.</b> If you land on a single opposing checker, you <b>pin</b> it – it cannot move until you move your checker away.</li>\n        <li>A point with 2 or more opposing checkers (or pinned by the opponent) is closed.</li>\n        <li>You bear off when all your checkers (including pinned ones) are home.</li>\n        <li><b>Mother:</b> if you pin the opponent\'s last checker on their starting point, you win immediately (2 points).</li>\n        <li><b>Gammon:</b> if the opponent has not borne off a single checker – 2 points.</li>\n      </ul>': '\n      <p>Всеки играч започва с всичките си 15 пула на една точка – най-далечната от дома му – и ги движи до дома, откъдето ги изнася.</p>\n      <ul>\n        <li>Движението е като в обикновената табла: белите към долния десен ъгъл, черните – огледално.</li>\n        <li><b>Няма биене.</b> Ако спрете върху единичен противников пул, вие го <b>затапвате</b> – той не може да мърда, докато не махнете пула си оттам.</li>\n        <li>Точка с 2 или повече противникови пула (или затапена от противника) е затворена.</li>\n        <li>Изнасяте, когато всичките ви пулове (включително затапените) са в дома.</li>\n        <li><b>Майка:</b> ако затапите последния пул на противника на началната му точка, печелите веднага (2 точки).</li>\n        <li><b>Марс:</b> ако противникът не е изнесъл нито един пул – 2 точки.</li>\n      </ul>',
  '\n      <p>Played by three with 52 cards. Each player gets 16 cards and 4 stay in the <b>swamp</b>. Play goes counter-clockwise.</p>\n      <ul>\n        <li><b>Goal:</b> the dealer must take <b>8</b> tricks, the next player – <b>5</b>, the third – <b>3</b>.</li>\n        <li>The dealer takes the swamp, names trumps (no "no trumps") and discards 4 cards.</li>\n        <li>The player after the dealer leads. You must follow suit; if you can\'t – play anything (you don\'t have to trump).</li>\n        <li>The trick is won by the highest trump, or if there are no trumps – by the highest card of the suit led. The ace is highest.</li>\n        <li><b>Points:</b> each trick above the goal is +1, each below is −1. The first to reach the chosen score (e.g. +10) wins.</li>\n        <li><b>Exchange:</b> in the next deal everyone who took more than their goal gives as many cards as they took in excess to those who fell short (to each – as many as they lacked). The receiver returns their strongest card of the same suit for each card.</li>\n      </ul>': '\n      <p>Играе се от трима с 52 карти. Всеки получава по 16 карти, а 4 остават в <b>блатото</b>. Играе се обратно на часовниковата стрелка.</p>\n      <ul>\n        <li><b>Цел:</b> раздаващият трябва да вземе <b>8</b> ръце, следващият – <b>5</b>, третият – <b>3</b>.</li>\n        <li>Раздаващият взема блатото, обявява коз (без „без коз“) и сваля 4 карти.</li>\n        <li>Първи играе следващият след раздаващия. Длъжни сте да отговорите на боята; ако нямате – играете каквото искате (не сте длъжни да цакате).</li>\n        <li>Ръката взема най-високият коз, а ако няма коз – най-високата карта от изиграната боя. Асото е най-силно.</li>\n        <li><b>Точки:</b> всяка ръка над целта е +1, всяка под целта е −1. Печели първият, стигнал избрания резултат (напр. +10).</li>\n        <li><b>Размяна:</b> в следващото раздаване всеки, взел повече от целта си, дава толкова карти, колкото е взел в повече, на изостаналите (на всеки – колкото му не достигат). Получателят връща за всяка карта най-силната си карта от същата боя.</li>\n      </ul>',
  '\n      <p>Played with 24 cards (9, jack, queen, king, 10, ace). The goal is to be the first to collect 66 points in the deal.</p>\n      <ul>\n        <li><b>Values:</b> ace 11, ten 10, king 4, queen 3, jack 2, nine 0.</li>\n        <li>While there is a stock you don\'t have to follow suit. The trick winner draws first.</li>\n        <li><b>Twenty/forty:</b> when it is your turn and you hold the queen and king of a suit, playing one of them declares 20 points (40 for trumps). The points count once you have won at least one trick.</li>\n        <li><b>Exchanging the 9:</b> the nine of trumps can be exchanged for the face-up trump while the stock has more than 2 cards.</li>\n        <li><b>Closing:</b> on your turn you can close the stock. Then (and when the stock runs out) you must follow suit, play higher and trump.</li>\n        <li><b>Match points:</b> 3 if the opponent has no tricks, 2 if they have under 33 points, 1 otherwise. If the closer doesn\'t reach 66 – the opponent gets 3. If nobody reaches 66, the winner of the last trick wins.</li>\n        <li>The match is to 11 points.</li>\n      </ul>': '\n      <p>Играе се с 24 карти (9, вале, дама, поп, 10, асо). Целта е първи да съберете 66 точки в раздаването.</p>\n      <ul>\n        <li><b>Стойности:</b> асо 11, десетка 10, поп 4, дама 3, вале 2, девятка 0.</li>\n        <li>Докато има тесте, не сте длъжни да отговаряте на боята. Победителят в ръката тегли първи.</li>\n        <li><b>Двайсет/четирийсет:</b> когато сте на ход и имате дама и поп от една боя, при изиграване на единия от тях се обявяват 20 точки (40 ако е коз). Точките се зачитат, след като имате поне една взета ръка.</li>\n        <li><b>Смяна на 9-ка:</b> девятката коз може да се смени с открития коз, докато в тестето има повече от 2 карти.</li>\n        <li><b>Затваряне:</b> когато сте на ход, можете да затворите тестето. Тогава (и когато тестето свърши) трябва да се отговаря на боята, да се качва и да се цака.</li>\n        <li><b>Точки за мача:</b> 3 ако противникът няма взета ръка, 2 ако има под 33 точки, 1 иначе. Ако затворилият не стигне 66 – противникът взема 3. Ако никой не стигне 66, печели взелият последната ръка.</li>\n        <li>Мачът е до 11 точки.</li>\n      </ul>',
  '\n      <p>Played with 32 cards from 7 to ace, in pairs (you and the player opposite you). Play goes counter-clockwise.</p>\n      <ul>\n        <li><b>Bidding:</b> 5 cards are dealt to each player. Bids are Clubs &lt; Diamonds &lt; Hearts &lt; Spades &lt; No trumps &lt; All trumps. You can Double (x2) and Redouble (x4). After three passes the bidding ends. If everyone passes – a new deal.</li>\n        <li>After the bidding everyone gets 3 more cards.</li>\n        <li><b>Play:</b> you must follow suit. If you can\'t – you must trump (unless your partner is winning the trick). In trumps and all trumps you must play higher.</li>\n        <li><b>Declarations</b> (in the first trick): tierce 20, quarte 50, quint 100, four of a kind 100 (four jacks 200, four nines 150), belot (queen and king of trumps) 20. Declarations are automatic.</li>\n        <li><b>Points:</b> trumps – jack 20, nine 14, ace 11, ten 10, king 4, queen 3. Non-trumps – ace 11, ten 10, king 4, queen 3, jack 2. The last trick is worth 10. Capot (all tricks) – 90.</li>\n        <li>If the bidding team has fewer points it is "inside" and all points go to the opponents. On a tie the points "hang" for the next deal.</li>\n        <li>The first team to reach the target wins (151 by default).</li>\n      </ul>': '\n      <p>Играе се с 32 карти от 7 до асо, по двойки (вие и играчът срещу вас). Играта е обратно на часовниковата стрелка.</p>\n      <ul>\n        <li><b>Обявяване:</b> раздават се по 5 карти. Обявява се Спатия &lt; Каро &lt; Купа &lt; Пика &lt; Без коз &lt; Всичко коз. Може да се даде Контра (x2) и Реконтра (x4). След три паса обявяването спира. Ако всички пасуват – ново раздаване.</li>\n        <li>След обявяването всеки получава още 3 карти.</li>\n        <li><b>Игра:</b> длъжни сте да отговорите на боята. Ако нямате – длъжни сте да цакате (ако партньорът ви не държи ръката). При коз и всичко коз трябва да се качва.</li>\n        <li><b>Анонси</b> (в първата ръка): терца 20, кварта 50, квинта 100, каре 100 (каре вале 200, каре девятки 150), белот (дама и поп коз) 20. Анонсите са автоматични.</li>\n        <li><b>Точки:</b> коз – вале 20, девятка 14, асо 11, десетка 10, поп 4, дама 3. Некоз – асо 11, десетка 10, поп 4, дама 3, вале 2. Последната ръка носи 10. Валат (всички ръце) – 90.</li>\n        <li>Ако обявилият отбор има по-малко точки – „вътре“ е и всички точки отиват при противника. При равенство точките „висят“ за следващото раздаване.</li>\n        <li>Печели първият отбор, достигнал целта (по подразбиране 151).</li>\n      </ul>',
  '\n      <p>Standard FIDE rules: castling, en passant, promotion, checkmate, stalemate, draw by threefold repetition, the 50-move rule and insufficient material.</p>\n      <p><b>Controls:</b> drag a piece, or tap a piece and then a square. The dots show the possible moves.</p>\n      <p>You can take back a move, flip the board or resign.</p>': '\n      <p>Стандартни правила на ФИДЕ: рокада, ан пасан, произвеждане на пешка, мат, пат, реми при повторение на позицията три пъти, правило на 50-те хода и недостатъчен материал.</p>\n      <p><b>Управление:</b> плъзнете фигура или натиснете фигура и след това поле. Точките показват възможните ходове.</p>\n      <p>Можете да върнете ход, да обърнете дъската или да се предадете.</p>',
  '\n      <p>The goal is to move all 15 of your checkers to your home (bottom right) and bear them off first.</p>\n      <ul>\n        <li>You move counter-clockwise – from top right to bottom right.</li>\n        <li>Each die is a separate move. With doubles you play the number four times.</li>\n        <li>You cannot land on a point with 2 or more opposing checkers (a closed "door").</li>\n        <li>A single opposing checker can be hit – it goes to the bar and must enter again.</li>\n        <li>While you have a checker on the bar, you must enter it first.</li>\n        <li>You bear off only when all checkers are home. If the dice allow it, you must play both dice, and if only one is possible – the larger one.</li>\n        <li><b>Gammon</b>: if the opponent has not borne off a single checker – you win 2 points.</li>\n      </ul>\n      <p><b>Controls:</b> tap a checker, then the point where you want it to go (highlighted). Tapping the selected checker again moves it with the larger die. On a phone held upright the board rotates to be larger.</p>': '\n      <p>Целта е да придвижите всичките си 15 пула до своя дом (долу вдясно) и да ги изнесете първи.</p>\n      <ul>\n        <li>Движите се обратно на часовниковата стрелка – от горе вдясно към долу вдясно.</li>\n        <li>Всеки зар е отделен ход. При чифт (дюшеш) играете числото четири пъти.</li>\n        <li>Не можете да спрете на позиция с 2 или повече противникови пула (затворена „врата“).</li>\n        <li>Единичен противников пул може да бъде ударен – той отива на бара и трябва да влезе отново.</li>\n        <li>Докато имате пул на бара, първо трябва да го вкарате.</li>\n        <li>Изнасяте пулове само когато всички са в дома. Ако заровете позволяват, сте длъжни да изиграете и двата зара, а ако е възможен само един – по-големия.</li>\n        <li><b>Марс</b>: ако противникът не е изнесъл нито един пул – печелите 2 точки.</li>\n      </ul>\n      <p><b>Управление:</b> натиснете пул, после позицията, където искате да отиде (подсветена). Повторно натискане на избрания пул го мести с по-големия зар. На вертикален телефон дъската се завърта, за да е по-едра.</p>',
  '\n      <p>The goal is to sort all 52 cards onto the four foundations (top right) – by suit, from ace to king.</p>\n      <ul>\n        <li>In the columns cards are stacked in descending order with alternating colours (red on black and vice versa).</li>\n        <li>You can also move whole sorted groups. Only a king (with the cards on it) can be placed in an empty column.</li>\n        <li>A face-down card turns over when it is uncovered.</li>\n        <li>Tap the stock to draw 1 or 3 cards. When it runs out, the waste is turned over again.</li>\n        <li>When all cards in the columns are face up, the <b>Finish</b> button sorts the rest automatically.</li>\n      </ul>\n      <p><b>Controls:</b> tap a card – it goes to the best place by itself; or drag it wherever you want. There is undo and a hint.</p>\n      <p><b>Online:</b> 2–4 players sort the same deal at the same time and see each other\'s progress. Whoever finishes first wins (or the last one remaining if the others give up).</p>': '\n      <p>Целта е да подредите всичките 52 карти в четирите основи (горе вдясно) – по бои, от асо до поп.</p>\n      <ul>\n        <li>В колоните картите се нареждат в низходящ ред с редуващи се цветове (червено върху черно и обратно).</li>\n        <li>Можете да местите и цели подредени групи. В празна колона може да се постави само поп (заедно с картите върху него).</li>\n        <li>Затворена карта се обръща, когато открие отгоре ѝ.</li>\n        <li>Натиснете тестето, за да теглите по 1 или 3 карти. Когато свърши, отпадъкът се обръща отново.</li>\n        <li>Когато всички карти в колоните са открити, бутонът <b>Довърши</b> нарежда останалото автоматично.</li>\n      </ul>\n      <p><b>Управление:</b> докоснете карта – тя сама отива на най-доброто място; или я плъзнете където искате. Има връщане на ход и подсказка.</p>\n      <p><b>Онлайн:</b> 2–4 играчи нареждат едно и също раздаване едновременно и виждат напредъка си. Печели който нареди пръв (или който остане последен, ако другите се откажат).</p>',
  ' (ally)': ' (съюзник)',
  ' (backgammon)': ' (бекгемон)',
  ' (counter −{0})': ' (ответно −{0})',
  ' (gammon)': ' (марс)',
  ' (pinned mother)': ' (затапена майка)',
  ' (tactical battle)': ' (тактическа битка)',
  ' (you)': ' (вие)',
  ' ({0}|{1}) · {2} tiles · disappears in ': ' ({0}|{1}) · {2} полета · изчезва след ',
  ' M': ' млн',
  ' Shared chat': ' Общ чат',
  ' They return in ': ' Връщат се след ',
  ' beautiful.': ' красиви.',
  ' in the bottom bar.': ' в долната лента.',
  ' on behalf of your team': ' от името на отбора ви',
  ' online': ' онлайн',
  ' playing {0}': ' играе {0}',
  ' ~{0} soldiers': ' ~{0} войници',
  ' · arrives at {0}': ' · пристига в {0}',
  ' · attacker: {0}': ' · нападател: {0}',
  ' · computer': ' · компютър',
  ' · hanging {0}': ' · висят {0}',
  ' · losses ~{0}': ' · загуби ~{0}',
  ' · reported by {0} · {1}': ' · докладван от {0} · {1}',
  ' · storage {0}': ' · склад {0}',
  ' · you have {0}': ' · имате {0}',
  ' · {0} members': ' · {0} членове',
  ' · {0} rulers': ' · {0} владетели',
  ' · {0} · {1} pcs.': ' · {0} · {1} бр.',
  ' · {0} · {1} pts · {2} cities': ' · {0} · {1} т. · {2} гр.',
  ' · 🌙 night bonus for you': ' · 🌙 нощен бонус за вас',
  ' – the line-up for defense and automatic battles': ' – подредбата при отбрана и автоматични битки',
  '({0}|{1}) · {2} tiles from {3}{4}': '({0}|{1}) · {2} полета от {3}{4}',
  '+ Add': '+ Добави',
  '+0.2% attack for the army the hero travels with': '+0,2% атака на войската, с която е героят',
  '+0.2% defense for the army in the hero\'s city': '+0,2% защита на войската в града на героя',
  '+1% production in the hero\'s city (up to 25%)': '+1% производство в града на героя (до 25%)',
  '+10% army attack': '+10% атака на войската',
  '+10% army defense': '+10% защита на войската',
  '+10% infantry attack': '+10% атака на пехотата',
  '+10% to all resources': '+10% към всички ресурси',
  '+15% food': '+15% храна',
  '+15% gold': '+15% злато',
  '+15% stone': '+15% камък',
  '+15% wood': '+15% дърво',
  '+20% attack for archers': '+20% атака на стрелците',
  '+20% attack for infantry and spearmen': '+20% атака на пехотата и копиеносците',
  '+25% loot from raids': '+25% плячка от набези',
  '+25% mana': '+25% мана',
  '+4 hero attack in battle': '+4 атака на героя в битка',
  '+50% to the wall bonus': '+50% към бонуса на стената',
  '+{0} hero attack': '+{0} атака на героя',
  '+{0} hero health, −{1}% wounds': '+{0} живот на героя, −{1}% рани',
  '+{0} in 7 days': '+{0} за 7 дни',
  '+{0}% experience': '+{0}% опит',
  '+{0}% hero speed': '+{0}% скорост на героя',
  '+{0}% recovery per hour': '+{0}% възстановяване на час',
  '0 moves': '0 хода',
  '1 card': 'По 1 карта',
  '1 day': '1 ден',
  '1 point': '1 точка',
  '1 week': '1 седмица',
  '2 vs 2 · with bots or online': '2 на 2 · с ботове или онлайн',
  '2–4 · with bots or online': '2–4 · с ботове или онлайн',
  '3 cards': 'По 3 карти',
  '3 days': '3 дни',
  '3 points': '3 точки',
  '3-5-8 for three – everyone must make their tricks.': '3-5-8 за трима – всеки трябва да изкара своите ръце.',
  '30 days': '30 дни',
  '3D dice': '3D зарове',
  '5 points': '5 точки',
  '50-move rule': 'Правило на 50-те хода',
  '66 points': '66 точки',
  '<b>{0}</b> hasn\'t played for a while.': '<b>{0}</b> не е играл отдавна.',
  '<b>{0}</b> lost the connection. Waiting… {1} s, then – {2}.': '<b>{0}</b> прекъсна връзката. Изчакваме… {1} с, след това – {2}.',
  '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">\n    <defs>{0}{1}\n      <radialGradient id="be-felt" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#23854f"/><stop offset=".7" stop-color="#0b3d24"/><stop offset="1" stop-color="#03140b"/></radialGradient>\n      <linearGradient id="be-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a3"/><stop offset="1" stop-color="#d79a2b"/></linearGradient>\n    </defs>\n    <rect width="320" height="180" fill="url(#be-felt)"/>\n    {2}\n    {3}\n    {4}\n    {5}\n    {6}\n    <text x="302" y="34" text-anchor="end" font-family="Unbounded,Inter,sans-serif" font-size="15" font-weight="700" fill="url(#be-gold)" filter="url(#be-glow)">All trumps</text>\n  </svg>': '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">\n    <defs>{0}{1}\n      <radialGradient id="be-felt" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#23854f"/><stop offset=".7" stop-color="#0b3d24"/><stop offset="1" stop-color="#03140b"/></radialGradient>\n      <linearGradient id="be-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a3"/><stop offset="1" stop-color="#d79a2b"/></linearGradient>\n    </defs>\n    <rect width="320" height="180" fill="url(#be-felt)"/>\n    {2}\n    {3}\n    {4}\n    {5}\n    {6}\n    <text x="302" y="34" text-anchor="end" font-family="Unbounded,Inter,sans-serif" font-size="15" font-weight="700" fill="url(#be-gold)" filter="url(#be-glow)">Всичко коз</text>\n  </svg>',
  '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">\n    <defs>{0}{1}\n      <radialGradient id="bl-felt" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#5a3fa0"/><stop offset=".7" stop-color="#21134a"/><stop offset="1" stop-color="#08041a"/></radialGradient>\n      <linearGradient id="bl-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a3"/><stop offset="1" stop-color="#d79a2b"/></linearGradient>\n    </defs>\n    <rect width="320" height="180" fill="url(#bl-felt)"/>\n    {2}\n    {3}\n    {4}\n    {5}\n    <text x="248" y="100" text-anchor="middle" font-family="Unbounded,Inter,sans-serif" font-size="34" font-weight="800" fill="url(#bl-gold)" filter="url(#bl-glow)">3·5·8</text>\n    <text x="248" y="126" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="11" font-weight="700" letter-spacing="3" fill="#e2d6ff">BLATO</text>\n  </svg>': '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">\n    <defs>{0}{1}\n      <radialGradient id="bl-felt" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#5a3fa0"/><stop offset=".7" stop-color="#21134a"/><stop offset="1" stop-color="#08041a"/></radialGradient>\n      <linearGradient id="bl-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a3"/><stop offset="1" stop-color="#d79a2b"/></linearGradient>\n    </defs>\n    <rect width="320" height="180" fill="url(#bl-felt)"/>\n    {2}\n    {3}\n    {4}\n    {5}\n    <text x="248" y="100" text-anchor="middle" font-family="Unbounded,Inter,sans-serif" font-size="34" font-weight="800" fill="url(#bl-gold)" filter="url(#bl-glow)">3·5·8</text>\n    <text x="248" y="126" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="11" font-weight="700" letter-spacing="3" fill="#e2d6ff">БЛАТО</text>\n  </svg>',
  '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">\n    <defs>{0}{1}\n      <radialGradient id="sa-felt" cx=".45" cy=".42" r=".75"><stop offset="0" stop-color="#8a2140"/><stop offset=".7" stop-color="#3a0a18"/><stop offset="1" stop-color="#120206"/></radialGradient>\n      <linearGradient id="sa-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a3"/><stop offset="1" stop-color="#d79a2b"/></linearGradient>\n    </defs>\n    <rect width="320" height="180" fill="url(#sa-felt)"/>\n    {2}\n    {3}\n    {4}\n    <text x="250" y="110" text-anchor="middle" font-family="Unbounded,Inter,sans-serif" font-size="54" font-weight="800" fill="url(#sa-gold)" filter="url(#sa-glow)">66</text>\n    <text x="250" y="136" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="11" font-weight="700" letter-spacing="3" fill="#ffc9d3">SANTASE</text>\n  </svg>': '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">\n    <defs>{0}{1}\n      <radialGradient id="sa-felt" cx=".45" cy=".42" r=".75"><stop offset="0" stop-color="#8a2140"/><stop offset=".7" stop-color="#3a0a18"/><stop offset="1" stop-color="#120206"/></radialGradient>\n      <linearGradient id="sa-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a3"/><stop offset="1" stop-color="#d79a2b"/></linearGradient>\n    </defs>\n    <rect width="320" height="180" fill="url(#sa-felt)"/>\n    {2}\n    {3}\n    {4}\n    <text x="250" y="110" text-anchor="middle" font-family="Unbounded,Inter,sans-serif" font-size="54" font-weight="800" fill="url(#sa-gold)" filter="url(#sa-glow)">66</text>\n    <text x="250" y="136" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="11" font-weight="700" letter-spacing="3" fill="#ffc9d3">САНТАСЕ</text>\n  </svg>',
  '@{0} · member since {1}': '@{0} · член от {1}',
  'A Hall of Heroes is required': 'Нужна е Зала на героите',
  'A Hall of Heroes is required in this city.': 'Нужна е Зала на героите в този град.',
  'A Home for the Hero': 'Дом за героя',
  'A New Age': 'Нова епоха',
  'A Roof Overhead': 'Покрив над главата',
  'A banned player cannot play Evil Empires or write in the lobby.': 'Блокираният не може да играе Evil Empires и да пише в лобито.',
  'A city can be founded here with settlers.': 'Тук може да се основе град със заселници.',
  'A city cannot be founded here.': 'Тук не може да се основе град.',
  'A game is already being played in this room. Create a new room or choose another one.': 'В тази стая вече се играе. Създайте нова стая или изберете друга.',
  'A necromancer\'s army, raised from the graves of the old empire.': 'Армия на некромант, вдигната от гробовете на старата империя.',
  'A new Evil Empires world – e.g. for a new season.': 'Нов свят на Evil Empires – напр. за нов сезон.',
  'A new city requires Citadel level {0}.': 'За нов град е нужна Цитадела ниво {0}.',
  'A people of mages and monster hunters, trained in secret towers.': 'Народ от магьосници и ловци на чудовища, обучавани в тайни кули.',
  'A richer reward and worse wounds. The hero may die.': 'По-богата награда и по-тежки рани. Героят може да загине.',
  'A second construction queue': 'Втора опашка за строеж',
  'A six! Roll': 'Шестица! Хвърлете',
  'ASH': 'ПЕП',
  'Abandoned city': 'Изоставен град',
  'Academy': 'Академия',
  'Academy level {0}': 'Академия ниво {0}',
  'Accept': 'Приеми',
  'Accounts': 'Акаунти',
  'Active': 'Активен',
  'Add Evil Games to the home screen': 'Добавете Evil Games на началния екран',
  'Add friends, see who is online and invite them to a game.': 'Добавете приятели, вижте кой е на линия и ги поканете на игра.',
  'Admin': 'Админ',
  'Administration': 'Администрация',
  'Advance to the {0}': 'Преход към {0}',
  'Adventure': 'Приключение',
  'Adventure ({0})': 'Приключение ({0})',
  'Adventures': 'Приключения',
  'After a victory some of the fallen rise as skeletons': 'След победа част от падналите стават скелети',
  'Against the computer or online': 'Срещу компютъра или онлайн',
  'Age of Darkness': 'Епоха на мрака',
  'Age of Kingdoms': 'Епоха на кралствата',
  'Agriculture': 'Земеделие',
  'All checkers start from one corner. No hitting – a single checker gets pinned.': 'Всички пулове тръгват от един ъгъл. Не се бие – единичен пул се затапва.',
  'All empires, alliances and the map are deleted forever. The players start over.': 'Всички империи, съюзи и картата се изтриват завинаги. Играчите започват отначало.',
  'All progress will be deleted forever. Are you sure?': 'Цялият напредък ще бъде изтрит завинаги. Сигурни ли сте?',
  'All the others gave up – you win!': 'Всички други се отказаха – печелите!',
  'All trumps': 'Всичко коз',
  'Alliance': 'Съюз',
  'Alliance chat': 'Чат на съюза',
  'Alliance membership (level 1) and founding an alliance (level 3). Each level gives 3 alliance slots.': 'Членство в съюз (ниво 1) и основаване на съюз (ниво 3). Всяко ниво дава 3 места в съюза.',
  'Alliance name': 'Име на съюза',
  'Alliance slots: {0}': 'Места в съюза: {0}',
  'Alliances': 'Съюзи',
  'Allows a new city': 'Позволява нов град',
  'Alone or online race': 'Сам или онлайн състезание',
  'Already acted this turn.': 'Действа вече този ход.',
  'Already have a profile? ': 'Вече имате профил? ',
  'Already researched.': 'Вече е изследвано.',
  'Already under construction.': 'Вече се строи.',
  'Altar': 'Олтар',
  'Amount': 'Брой',
  'Amulet': 'Амулет',
  'An administrator cannot be banned.': 'Администратор не може да бъде блокиран.',
  'An unfinished online match was counted as a loss.': 'Незавършен онлайн мач беше отчетен като загуба.',
  'Another ruler conquered it before you.': 'Друг владетел го завладя преди вас.',
  'Archer': 'Стрелец',
  'Archers': 'Стрелци',
  'Are you sure you want to resign? The game will count as a loss.': 'Сигурни ли сте, че искате да се предадете? Играта ще се отчете като загуба.',
  'Armor': 'Броня',
  'Army': 'Армия',
  'Ash Age': 'Пепелна епоха',
  'Ash Bandits': 'Пепелни разбойници',
  'At home in {0}': 'У дома в {0}',
  'At least {0} players are needed': 'Нужни са поне {0} играчи',
  'At {0}: {1}': 'При {0}: {1}',
  'Attack': 'Атака',
  'Attack a barbarian camp: on the Map select the tents and press "Raid".': 'Нападнете варварски лагер: на Картата изберете палатките и натиснете „Набег“.',
  'Attack: oasis ({0}|{1})': 'Атака: оазис ({0}|{1})',
  'Attack: {0}': 'Атака: {0}',
  'Attacker': 'Нападател',
  'Automatic': 'Автоматично',
  'Avatar colour': 'Цвят на аватара',
  'Average units': 'Средни единици',
  'BLD': 'КРВ',
  'Back': 'Назад',
  'Backgammon': 'Табла',
  'Backgammon board': 'Дъска за табла',
  'Backgammon without hitting – a single checker gets pinned.': 'Табла без биене – единичен пул се затапва.',
  'Backgammon, chess, belot and santase – in the browser, on computer and phone. Sign up to track your statistics and climb the ranking.': 'Табла, шах, белот и сантасе – в браузъра, на компютър и телефон. Регистрирайте се, за да следите статистиката си и да се изкачите в класацията.',
  'Bag': 'Торба',
  'Ban': 'Блокирай',
  'Ban the author': 'Блокирай автора',
  'Ban: {0}': 'Блокиране: {0}',
  'Bandit Fort': 'Бандитски форт',
  'Banking': 'Банкерство',
  'Banned': 'Блокирани',
  'Barracks': 'Казарма',
  'Barracks level {0} required.': 'Нужна е казарма ниво {0}.',
  'Barracks required.': 'Нужна е казарма.',
  'Battering Ram': 'Таран',
  'Battle': 'Битка',
  'Battle: {0}': 'Битка: {0}',
  'Battles waiting': 'Битки, които чакат',
  'Beginner protection – nobody can attack you': 'Защита за новаци – никой не може да ви напада',
  'Behind Stake and Stone': 'Зад кол и камък',
  'Being researched.': 'Изследва се.',
  'Belot': 'Белот',
  'Berserker': 'Берсерк',
  'Bid: {0}{1} ({2})': 'Обявено: {0}{1} ({2})',
  'Black': 'Черните',
  'Black Boyan': 'Черния Боян',
  'Blade of the Fall': 'Острието на Падението',
  'Blato': 'Блато',
  'Blood on the Ashes': 'Кръв по пепелта',
  'Blue': 'Сини',
  'Boar Rider': 'Ездач на глиган',
  'Board': 'Дъска',
  'Board style': 'Вид на дъската',
  'Bone Amulet': 'Костен амулет',
  'Bone Pikeman': 'Костен пикинер',
  'Bone Slinger': 'Костен прашкар',
  'Bonecrusher': 'Костотрошач',
  'Bones': 'Кости',
  'Bot': 'Бот',
  'Bot Georgi': 'Бот Георги',
  'Bot Ivan': 'Бот Иван',
  'Bot Maria': 'Бот Мария',
  'Bot Petar': 'Бот Петър',
  'Both in the same direction, a single checker blocks, doubles escalate.': 'Двамата в една посока, единичен пул блокира, чифтовете ескалират.',
  'Both players move in the same direction. A single checker blocks the point.': 'Двамата се движат в една посока. Единичен пул блокира точката.',
  'Bows': 'Лъкове',
  'Brings gold and trains paladins.': 'Носи злато и обучава паладини.',
  'Bronze Age': 'Бронзова епоха',
  'Bronze Armor': 'Бронзова броня',
  'Bronze Casting': 'Бронзолеене',
  'Bronze Helmet': 'Бронзов шлем',
  'Bronze Sword': 'Бронзов меч',
  'Brute': 'Грубиян',
  'Build': 'Построй',
  'Build a farm': 'Постройте ферма',
  'Build a graveyard': 'Постройте гробище',
  'Build a hideout': 'Постройте скривалище',
  'Build a palisade': 'Постройте палисада',
  'Build a palisade – the first defense against attacks by the barbarian rulers.': 'Постройте палисада – първата защита срещу нападенията на варварските владетели.',
  'Build a quarry': 'Постройте кариера',
  'Build a sawmill': 'Постройте дъскорезница',
  'Build a sawmill – wood is needed for all construction.': 'Постройте дъскорезница – дървото трябва за всички строежи.',
  'Build a temple': 'Постройте храм',
  'Build a {0} – it feeds the city. Tap the glowing plot.': 'Постройте {0} – тя храни града. Натиснете светещия парцел.',
  'Build an Embassy to join an alliance (level 1) or found your own (level 3).': 'Постройте Посолство, за да се присъедините към съюз (ниво 1) или да основете свой (ниво 3).',
  'Build an academy': 'Постройте академия',
  'Build an academy to research technologies.': 'Постройте академия, за да изследвате технологии.',
  'Build an altar': 'Постройте олтар',
  'Build barracks': 'Постройте казарма',
  'Build barracks to train troops.': 'Постройте казарма, за да обучавате войска.',
  'Build houses': 'Постройте жилища',
  'Build stables': 'Постройте конюшня',
  'Build the Hall of Heroes': 'Постройте Зала на героите',
  'Build your race\'s unique building': 'Постройте уникалната сграда на расата',
  'Building level {0} – remaining ': 'Строи се ниво {0} – остават ',
  'Buildings up to level {0}': 'Сградите до ниво {0}',
  'Bulgarian belot 2 vs 2 – you and a partner against two.': 'Български белот 2 на 2 – вие и партньор срещу двама.',
  'Burgundy': 'Бордо',
  'By game': 'По игри',
  'Campaign': 'Кампания',
  'Cancel': 'Отказ',
  'Cancel construction': 'Откажи строежа',
  'Capital': 'Столица',
  'Capot': 'Валат',
  'Card points': 'Точки от карти',
  'Cards to draw': 'Теглене',
  'Carpentry': 'Дърводелство',
  'Carries loot': 'Носи плячка',
  'Catapult': 'Катапулт',
  'Catch some of the attackers before they reach the walls.': 'Залавят част от нападателите, преди да стигнат до стените.',
  'Catch up to {0} attackers': 'Залавят до {0} нападатели',
  'Cavalry': 'Конница',
  'Cavalry −{0}% training time': 'Конница −{0}% време за обучение',
  'Celtic': 'Келтски',
  'Centuries after the Fall the world is ashes. Choose a people and raise an empire that will outlive the darkness.': 'Векове след Падението светът е пепелище. Изберете народ и издигнете империя, която ще надживее мрака.',
  'Chain Mail': 'Плетена ризница',
  'Chance of victory: ': 'Шанс за победа: ',
  'Chat': 'Чат',
  'Check! It\'s your move.': 'Шах! Вие сте на ход.',
  'Checkmate': 'Мат',
  'Chess': 'Шах',
  'Chivalry': 'Рицарство',
  'Choose "Add to Home Screen" and then "Add".': 'Изберете „Добави към началния екран“ и после „Добави“.',
  'Choose a colour and the computer\'s level.': 'Изберете цвят и ниво на компютъра.',
  'Choose a free seat.': 'Изберете свободно място.',
  'Choose a game and keep racking up wins in the ranking.': 'Изберете игра и продължете да трупате победи в класацията.',
  'Choose a game – a room will be created and your friend will get an invitation.': 'Изберете игра – ще се създаде стая и приятелят ви ще получи покана.',
  'Choose a game – we\'ll connect you with the first free opponent looking for the same.': 'Изберете игра – ще ви свържем с първия свободен противник, който търси същото.',
  'Choose an amount.': 'Изберете брой.',
  'Choose troops.': 'Изберете войска.',
  'Choose trumps': 'Изберете коз',
  'Citadel': 'Цитадела',
  'Citadel level 10': 'Цитадела ниво 10',
  'Citadel level 12': 'Цитадела ниво 12',
  'Citadel level 15': 'Цитадела ниво 15',
  'Citadel level 2': 'Цитадела ниво 2',
  'Citadel level 3': 'Цитадела ниво 3',
  'Citadel level 5': 'Цитадела ниво 5',
  'Citadel level 7': 'Цитадела ниво 7',
  'Citadel level {0}': 'Цитадела ниво {0}',
  'Citadel level {0} required.': 'Нужна е Цитадела ниво {0}.',
  'City': 'Град',
  'City Wall': 'Крепостна стена',
  'City conquered: {0}': 'Градът е завладян: {0}',
  'City founded: {0} ({1}|{2})': 'Основан град: {0} ({1}|{2})',
  'City name': 'Име на града',
  'City {0}': 'Град {0}',
  'Claim': 'Вземи',
  'Claim a forfeit win': 'Поискай служебна победа',
  'Claim the rewards for completed missions.': 'Вземете наградите за изпълнените мисии.',
  'Clan': 'Клан',
  'Clans from the ashlands who live off plunder.': 'Кланове от пепелищата, които живеят от плячка.',
  'Clans of the barbarian rulers': 'Кланове на варварските владетели',
  'Classic': 'Класически',
  'Classic "Klondike" – sort all the cards.': 'Класическият „Клондайк“ – подредете всички карти.',
  'Classic "regular" backgammon with 15 checkers.': 'Класическата „обикновена“ табла с 15 пула.',
  'Classic games. ': 'Класически игри. ',
  'Close': 'Затвори',
  'Clubs': 'Спатия',
  'Code: {0}. If the room doesn\'t exist or the host has left, go back to the lobby.': 'Код: {0}. Ако стаята не съществува или домакинът е излязъл, върнете се в лобито.',
  'Colour': 'Цвят',
  'Complete a research': 'Завършете изследване',
  'Complete one research': 'Завършете едно изследване',
  'Computer': 'Компютър',
  'Computer speed': 'Скорост на компютъра',
  'Computer · ': 'Компютър · ',
  'Confirm': 'Потвърди',
  'Confirmation': 'Потвърждение',
  'Connecting to the room…': 'Свързване със стаята…',
  'Connecting to the world…': 'Свързване със света…',
  'Connecting…': 'Свързване…',
  'Conquer an oasis': 'Завладейте оазис',
  'Conquered': 'Завладяхте',
  'Conquered city: {0} ({1}|{2})': 'Завладян град: {0} ({1}|{2})',
  'Construction complete: {0}{1}.': 'Завършен строеж: {0}{1}.',
  'Construction is 10% faster': 'Строежите са с 10% по-бързи',
  'Construction −{0}%': 'Строежите −{0}%',
  'Continue': 'Продължи',
  'Could not connect to the server: ': 'Неуспешна връзка със сървъра: ',
  'Count the game as a loss?': 'Да се отчете ли играта като загуба?',
  'Count the match as a loss?': 'Да се отчете ли мачът като загуба?',
  'Create a profile': 'Създайте профил',
  'Create a room': 'Създай стая',
  'Crested Helmet': 'Шлем с гребен',
  'Crop Rotation': 'Сеитбооборот',
  'Crossbowman': 'Арбалетчик',
  'Crossbows': 'Арбалети',
  'Crown of the Ancestors': 'Короната на прадедите',
  'Cursed Archer': 'Прокълнат стрелец',
  'Cuts and processes wood.': 'Сече и обработва дърво.',
  'Daily missions': 'Дневни мисии',
  'Danger zone': 'Опасна зона',
  'Dangerous adventure': 'Опасно приключение',
  'Dead': 'Мъртъв',
  'Dead Rider': 'Мъртъв конник',
  'Deal {0}': 'Раздаване {0}',
  'Deal {0} · {1}{2}': 'Раздаване {0} · {1}{2}',
  'Death Knight': 'Рицар на смъртта',
  'Declarations': 'Анонси',
  'Decline': 'Откажи',
  'Defeat': 'Поражение',
  'Defeat a level 1 camp': 'Победете лагер ниво 1',
  'Defeat a level 10 camp': 'Победете лагер ниво 10',
  'Defeat a level 15 camp': 'Победете лагер ниво 15',
  'Defeat a level 3 camp': 'Победете лагер ниво 3',
  'Defeat a level 5 camp – the barbarian warlord': 'Победете лагер ниво 5 – вожда на варварите',
  'Defeat a level 8 camp': 'Победете лагер ниво 8',
  'Defeat at {0} (level {1}).': 'Поражение при {0} (ниво {1}).',
  'Defeat the guards with the hero in the army to conquer the oasis (Hall of Heroes level 3/6/10; up to {0} tiles from the city). You have {1}/{2}.': 'Победете пазачите с героя във войската, за да завладеете оазиса (Зала на героите ниво 3/6/10; до {0} полета от града). Имате {1}/{2}.',
  'Defenders get +6% defense and +3% health per level.': 'Защитниците получават +6% защита и +3% живот на ниво.',
  'Defense': 'Отбрана',
  'Defense +{0}%': 'Защита +{0}%',
  'Defense: the wall adds a defense bonus, traps catch attackers, the hideout protects {0} of each resource in {1}. The watchtower sees attacks {2} before arrival. At night ({3}:00–{4}:00 Bulgarian time) defenders are +{5}% stronger.': 'Защита: стената дава бонус към защитата, капаните залавят нападатели, скривалището пази {0} от всеки ресурс в {1}. Стражевата кула вижда нападенията {2} преди пристигане. Нощем ({3}:00–{4}:00 българско време) защитниците са с +{5}% по-силни.',
  'Delete and start': 'Изтрий и започни',
  'Delete the message': 'Изтрий съобщението',
  'Demon Hunter': 'Ловец на демони',
  'Describe the reason.': 'Опишете причината.',
  'Destroyed · the barbarians are gathering: ': 'Разбит · варварите се събират: ',
  'Diamonds': 'Каро',
  'Difficulty': 'Трудност',
  'Digs up bones – the main resource of the undead.': 'Изравя кости – основния ресурс на немъртвите.',
  'Digs up more bones and raises ghouls.': 'Изравя още кости и вдига гулове.',
  'Diplomacy': 'Дипломация',
  'Diplomacy with [{0}]: {1}.': 'Дипломация с [{0}]: {1}.',
  'Discard 4 cards': 'Свалете 4 карти',
  'Display name': 'Име за показване',
  'Done': 'Готово',
  'Double!': 'Контра!',
  'Doubles – {0} with {1}–{2}.': 'Чифт – {0} с {1}–{2}.',
  'Dragon Scales': 'Люспите на дракона',
  'Draw': 'Реми',
  'Draw by agreement': 'Реми по споразумение',
  'Draw from the stock.': 'Теглете от тестето.',
  'Draw offer': 'Предложение за реми',
  'Drawing from the stock': 'Теглене от тестето',
  'Drop protection': 'Свали защитата',
  'E.g. insults, spam…': 'Напр. обиди, спам…',
  'Each level gives +3% attack and defense to the city\'s troops.': 'Всяко ниво дава +3% атака и защита на войската от града.',
  'East': 'Изток',
  'Easy': 'Лесно',
  'Economy': 'Стопанство',
  'Edit': 'Редактирай',
  'Edit profile': 'Редакция на профила',
  'Elo rating from online matches': 'Elo рейтинг от онлайн мачове',
  'Embassy': 'Посолство',
  'Embassy level 3 required.': 'Нужно е Посолство ниво 3.',
  'Embassy required.': 'Нужно е Посолство.',
  'Empire': 'Империя',
  'Empire name': 'Име на империята',
  'Empires': 'Империи',
  'Empty. Items are found on adventures.': 'Празна. Предметите се намират в приключения.',
  'End of protection': 'Край на защитата',
  'End turn': 'Край на хода',
  'Enemy hideouts protect 20% less': 'Скривалищата на врага пазят с 20% по-малко',
  'Engineering': 'Инженерство',
  'Enter a name.': 'Въведете име.',
  'Enter at least 2 letters.': 'Въведете поне 2 букви.',
  'Enter the Bronze Age': 'Преминете в Бронзовата епоха',
  'Enter the Iron Age': 'Преминете в Желязната епоха',
  'Equip': 'Сложи',
  'Equipment': 'Екипировка',
  'Escort': 'Охрана',
  'Everyone passed – a new deal': 'Всички пасуваха – ново раздаване',
  'Evil Games as an app': 'Evil Games като приложение',
  'Exchange the 9': 'Смени 9-ката',
  'Exchanging the 9': 'Смяна на 9-ката',
  'Experience {0} / {1}': 'Опит {0} / {1}',
  'Eyes in the Dark': 'Очи в мрака',
  'Fantasy': 'Фентъзи',
  'Farm': 'Ферма',
  'Farm, sawmill, quarry and mine at level 3': 'Ферма, дъскорезница, кариера и мина на ниво 3',
  'Fast': 'Бързо',
  'Favourite game: ': 'Любима игра: ',
  'Feudal Law': 'Феодално право',
  'Fewer': 'По-малко',
  'Fighting Pit': 'Бойна яма',
  'Final result: Us {0} – Them {1}': 'Краен резултат: Ние {0} – Те {1}',
  'Final score {0} : {1}': 'Краен резултат {0} : {1}',
  'Final score {0} : {1}{2}.': 'Краен резултат {0} : {1}{2}.',
  'Find an opponent': 'Търси противник',
  'Find players': 'Намери играчи',
  'Finish': 'Довърши',
  'Finish the battle': 'Приключи битката',
  'Flank': 'Фланг',
  'Flip': 'Обърни',
  'Food': 'Храна',
  'Forbidden.': 'Забранено.',
  'Forest': 'Гора',
  'Forfeit win due to inactivity.': 'Служебна победа заради бездействие.',
  'Forfeit win.': 'Служебна победа.',
  'Formation': 'Строй',
  'Fortifications': 'Укрепления',
  'Fortress': 'Крепост',
  'Forty!': 'Четирийсет!',
  'Found': 'Основи',
  'Found a second city': 'Основете втори град',
  'Found the empire': 'Основи империята',
  'Founding a city': 'Основаване на град',
  'Founding an alliance': 'Основаване на съюз',
  'Founding an alliance from level 3': 'Основаване на съюз от ниво 3',
  'Four of a kind {0}': 'Каре {0}',
  'Free': 'Свободно',
  'Free (bot)': 'Свободно (бот)',
  'Free (optional)': 'Свободно (по желание)',
  'Free land': 'Свободна земя',
  'Free seats are taken by bots if you start with fewer people.': 'Свободните места се заемат от ботове, ако започнете с по-малко хора.',
  'Friends': 'Приятели',
  'Friends ({0})': 'Приятели ({0})',
  'Friends online:': 'Приятели на линия:',
  'Front': 'Отпред',
  'Full rules, three difficulty levels.': 'Пълни правила, три нива на трудност.',
  'GULBARA': 'ГЮЛБАРА',
  'Game invitation': 'Покана за игра',
  'Game points': 'Точки за играта',
  'Games': 'Игри',
  'Games played': 'Изиграни игри',
  'Games portal': 'Игрален портал',
  'Gathers mana and trains witchers.': 'Събира мана и обучава вещери.',
  'Gathers mana from the rifts of the Fall.': 'Събира мана от разломите на Падението.',
  'Gathers souls and speeds up the hero\'s recovery (+3% per hour per level if the hero is in this city).': 'Събира души и ускорява възстановяването на героя (+3% на час на ниво, ако е в този град).',
  'Gave up · {0}/52 cards · {1}': 'Отказан · {0}/52 карти · {1}',
  'Georgi': 'Георги',
  'Ghost Archer': 'Призрачен стрелец',
  'Ghoul': 'Гул',
  'Give up': 'Откажи се',
  'Give up (loss)': 'Откажи се (загуба)',
  'Give {0} {1} to {2}': 'Дайте {0} {1} на {2}',
  'Giving up': 'Отказване',
  'Go back': 'Върни се',
  'Goal': 'Цел',
  'Gold': 'Злато',
  'Gold Mine': 'Златна мина',
  'Good game!': 'Добра игра!',
  'Goran the Bonecrusher': 'Горан Костотрошача',
  'Got it': 'Разбрах',
  'Grave Spearman': 'Гробен копиеносец',
  'Gravediggers': 'Гробокопачи',
  'Graveyard': 'Гробище',
  'Green': 'Зелени',
  'Grey Dragosh': 'Сивия Драгош',
  'Guard': 'Стражник',
  'Gulbara': 'Гюлбара',
  'Hall of Heroes': 'Зала на героите',
  'Hanging points – they go to the winner of the next deal.': 'Висящи точки – отиват при победителя в следващото раздаване.',
  'Hard': 'Трудно',
  'Health': 'Живот',
  'Health +{0}%': 'Живот +{0}%',
  'Health in battle': 'Живот в битка',
  'Health {0}%': 'Живот {0}%',
  'Heart of the Fall': 'Сърцето на Падението',
  'Hearth': 'Огнище',
  'Hearts': 'Купа',
  'Hello, ': 'Здравейте, ',
  'Hello, {0}!': 'Здравейте, {0}!',
  'Helmet': 'Шлем',
  'Hero': 'Герой',
  'Hero name': 'Име на героя',
  'Hero revival': 'Съживяване на героя',
  'Hidden Treasure': 'Скрито съкровище',
  'Hide': 'Скрий',
  'Hideout': 'Скривалище',
  'Hill': 'Хълм',
  'Hills': 'Хълмове',
  'Hint': 'Подсказка',
  'Home of the hero: revives them and allows conquering oases (levels 3, 6 and 10 – one oasis each).': 'Дом на героя: съживява го и позволява завладяване на оазиси (ниво 3, 6 и 10 – по един оазис).',
  'Home screen icon, full screen and notifications for Evil Empires.': 'Икона на началния екран, цял екран и известия за Evil Empires.',
  'Horse': 'Кон',
  'Horse Riding': 'Езда',
  'Horseman': 'Конник',
  'Horseshoes and Spurs': 'Подкови и шпори',
  'Houses': 'Жилища',
  'Humans': 'Хора',
  'Hunter': 'Ловец',
  'I\'m closing!': 'Затварям!',
  'Ice': 'Лед',
  'In Supabase turn off "Confirm email" (Authentication → Providers → Email).': 'В Supabase изключете "Confirm email" (Authentication → Providers → Email).',
  'In the Hall of Heroes of {0}.': 'В Залата на героите на {0}.',
  'In the next deal the players who took more exchange cards with those who fell short.': 'В следващото раздаване играчите, взели повече, разменят карти с изостаналите.',
  'Inactivity': 'Бездействие',
  'Incoming attacks': 'Входящи нападения',
  'Increase the population (room for troops) and bring taxes.': 'Увеличават населението (място за войска) и носят данъци.',
  'Increases how many resources you can store.': 'Увеличава колко ресурси можете да пазите.',
  'Infantry': 'Пехота',
  'Infantry and spears in front protect the archers; cavalry on the flanks hits the enemy\'s archers.': 'Пехотата и копията отпред пазят стрелците; конницата по фланговете удря стрелците на врага.',
  'Install': 'Инсталирай',
  'Insufficient material': 'Недостатъчен материал',
  'Invalid data.': 'Невалидни данни.',
  'Invalid formation.': 'Невалидна формация.',
  'Invalid match.': 'Невалиден мач.',
  'Invalid move.': 'Невалиден ход.',
  'Invalid moves.': 'Невалидни ходове.',
  'Invalid relation.': 'Невалидно отношение.',
  'Invalid room code.': 'Невалиден код на стая.',
  'Invalid subscription.': 'Невалиден абонамент.',
  'Invitation link': 'Връзка за покана',
  'Invite': 'Покани',
  'Invite a friend': 'Покани приятел',
  'Invite player': 'Покани играч',
  'Invite {0} to a game': 'Поканете {0} на игра',
  'Iron': 'Желязо',
  'Iron Age': 'Желязна епоха',
  'Iron Empire': 'Желязна империя',
  'Iron Ratko': 'Железния Ратко',
  'Iron Will': 'Желязна воля',
  'It\'s not your turn.': 'Не е ваш ред.',
  'Item: ': 'Предмет: ',
  'Javelineer': 'Копиехвъргач',
  'Join': 'Влез',
  'Join with a code': 'Влез с код',
  'Khan Zlorud': 'Кан Злоруд',
  'Kick': 'Изключване',
  'Kick {0}?': 'Да изключите ли {0}?',
  'Klondike Solitaire': 'Пасианс „Клондайк“',
  'Knight': 'Рицар',
  'Knowledge Is Power': 'Знание е сила',
  'Lair': 'Свърталище',
  'Lake': 'Езеро',
  'Later': 'По-късно',
  'Lead the battle': 'Поведи битката',
  'Leather Armor': 'Кожена броня',
  'Leather Cap': 'Кожена шапка',
  'Leave': 'Напусни',
  'Leave the alliance?': 'Да напуснете ли съюза?',
  'Leave the room': 'Напусни стаята',
  'Leaving': 'Напускане',
  'Let\'s begin': 'Да започваме',
  'Level': 'Ниво',
  'Level {0}': 'Ниво {0}',
  'Level {0} / {1}': 'Ниво {0} / {1}',
  'Level {0} · {1}': 'Ниво {0} · {1}',
  'Lich': 'Лич',
  'Link': 'Връзка',
  'Lobby': 'Лоби',
  'Lobby messages (24 h)': 'Съобщения в лобито (24 ч)',
  'Local world: shared only between the accounts in this browser.': 'Локален свят: споделен само между акаунтите в този браузър.',
  'Log in': 'Вход',
  'Log in to play and rack up wins.': 'Влезте, за да играете и да трупате победи.',
  'Log out': 'Изход',
  'Logistics': 'Логистика',
  'Looking for an opponent… (tap to cancel)': 'Търсим противник… (натиснете за отказ)',
  'Loot': 'Плячка',
  'Loot up to:': 'Плячка до:',
  'Lord of the Steppe': 'Повелителят на степта',
  'Losses': 'Загуби',
  'Losses: {0} · Enemies killed: {1}': 'Загуби: {0} · Избити врагове: {1}',
  'Loyalty': 'Лоялност',
  'Ludo': 'Не се сърди, човече',
  'Magister': 'Магистър',
  'Mana': 'Мана',
  'Map': 'Карта',
  'Marauders': 'Мародери',
  'Marble': 'Мрамор',
  'Marches': 'Походи',
  'Maria': 'Мария',
  'Masonry': 'Зидария',
  'Match': 'Мач',
  'Match not found.': 'Мачът не е намерен.',
  'Match to': 'Мач до',
  'Match to 11 points against the computer.': 'Мач до 11 точки срещу компютъра.',
  'Matches in 24 h': 'Мачове за 24 ч',
  'Maximum level for this age – advance to the next one.': 'Максимално ниво за епохата – преминете в следващата.',
  'Maximum level in this version.': 'Максимално ниво в тази версия.',
  'Medium': 'Средно',
  'Merchant Guild': 'Търговска гилдия',
  'Merida': 'Мерида',
  'Message': 'Съобщение',
  'Message to {0}…': 'Съобщение до {0}…',
  'Message…': 'Съобщение…',
  'Militiaman': 'Опълченец',
  'Mines gold.': 'Добива злато.',
  'Mines stone for walls and buildings.': 'Добива камък за стени и сгради.',
  'Mission "{0}"': 'Мисия „{0}“',
  'Missions': 'Мисии',
  'Morale': 'Морал',
  'Morale {0}% – the target is much weaker than you.': 'Морал {0}% – целта е много по-слаба от вас.',
  'Morale: {0}%': 'Морал: {0}%',
  'Morana the Witch': 'Вещицата Морана',
  'More': 'Повече',
  'More games': 'Още игри',
  'Mysticism': 'Мистицизъм',
  'Name (3+ letters) and tag (2–4 characters).': 'Име (3+ букви) и таг (2–4 знака).',
  'Necropolis': 'Некрополис',
  'New': 'Нова',
  'New Land': 'Нова земя',
  'New city from level 5': 'Нов град от ниво 5',
  'New conversation': 'Нов разговор',
  'New conversation with…': 'Нов разговор с…',
  'New empire': 'Нова империя',
  'New game': 'Нова игра',
  'New game of belot': 'Нова игра на белот',
  'New game of blato': 'Нова игра на блато',
  'New game of santase': 'Нова игра на сантасе',
  'New game of {0}': 'Нова игра на {0}',
  'New reports': 'Нови жалби',
  'New room': 'Нова стая',
  'New titles are coming to the portal soon.': 'Очаквайте скоро нови заглавия в портала.',
  'Next age': 'Следваща епоха',
  'Night Rider': 'Нощен ездач',
  'Night Steed': 'Нощен ат',
  'No adventures. A new one appears every few hours.': 'Няма приключения. Ново се появява на всеки няколко часа.',
  'No alliances yet.': 'Още няма съюзи.',
  'No connection to the game server.': 'Няма връзка със сървъра на играта.',
  'No connection to the referee: ': 'Няма връзка със съдията: ',
  'No connection to the server.': 'Няма връзка със сървъра.',
  'No connection to the server: ': 'Няма връзка със сървъра: ',
  'No connection to the world.': 'Няма връзка със света.',
  'No connection: ': 'Няма връзка: ',
  'No data.': 'Няма данни.',
  'No intel. Send scouts.': 'Няма сведения. Изпратете съгледвачи.',
  'No messages in the lobby yet.': 'Още няма съобщения в лобито.',
  'No messages yet.': 'Още няма съобщения.',
  'No messages yet. Say "Hello"!': 'Още няма съобщения. Кажете „Здравейте“!',
  'No more useful moves.': 'Няма повече полезни ходове.',
  'No new reports.': 'Няма нови жалби.',
  'No new requests.': 'Няма нови заявки.',
  'No open rooms. Create your own and invite a friend!': 'Няма отворени стаи. Създайте своя и поканете приятел!',
  'No other alliances.': 'Няма други съюзи.',
  'No players found.': 'Няма намерени играчи.',
  'No profile yet? ': 'Нямате профил? ',
  'No reports yet.': 'Още няма доклади.',
  'No results yet. Be the first!': 'Все още няма резултати. Бъдете първи!',
  'No room – build more houses.': 'Няма място – постройте още жилища.',
  'No sent requests.': 'Няма изпратени заявки.',
  'No such alliance.': 'Няма такъв съюз.',
  'No such building.': 'Няма такава сграда.',
  'No such camp.': 'Няма такъв лагер.',
  'No such city.': 'Няма такъв град.',
  'No such clan.': 'Няма такъв клан.',
  'No such construction.': 'Няма такъв строеж.',
  'No such item.': 'Няма такъв предмет.',
  'No such member.': 'Няма такъв член.',
  'No such player.': 'Няма такъв играч.',
  'No such reinforcements.': 'Няма такива подкрепления.',
  'No such ruler (maybe already conquered).': 'Няма такъв владетел (може би вече е завладян).',
  'No such ruler.': 'Няма такъв владетел.',
  'No such skill.': 'Няма такова умение.',
  'No such technology.': 'Няма такава технология.',
  'No such user.': 'Няма такъв потребител.',
  'No troops at home.': 'Няма войска у дома.',
  'No troops on the move. Choose a target on the Map.': 'Няма войска на път. Изберете цел от Картата.',
  'No trumps': 'Без коз',
  'Nobility': 'Благородство',
  'Nobleman': 'Благородник',
  'Nobody is online.': 'Никой не е на линия.',
  'None of your friends are online.': 'Никой от приятелите ви не е на линия.',
  'Normal': 'Нормално',
  'North': 'Север',
  'Not all conditions are met.': 'Не са изпълнени всички условия.',
  'Not built': 'Не е построена',
  'Not enough: {0}.': 'Не стига: {0}.',
  'Nothing can be built here.': 'Тук не може да се строи.',
  'Notifications about attacks and events': 'Известия за нападения и събития',
  'Notifications are blocked in the browser.': 'Известията са забранени в браузъра.',
  'Notifications are off.': 'Известията са изключени.',
  'Notifications are on (while the browser is open).': 'Известията са включени (докато браузърът е отворен).',
  'Notifications are on – they will arrive even when the game is closed.': 'Известията са включени – ще пристигат и когато играта е затворена.',
  'Novice': 'Послушник',
  'Now': 'Сега',
  'Oases: {0}': 'Оазиси: {0}',
  'Oasis ({0}|{1})': 'Оазис ({0}|{1})',
  'Oasis: +{0}% {1}': 'Оазис: +{0}% {1}',
  'Off': 'Изключени',
  'Offense': 'Нападение',
  'Offline': 'Не е на линия',
  'Old Nag': 'Дърта кранта',
  'On': 'Включени',
  'On arrival you lead the battle yourself, turn by turn (otherwise it is automatic). You have 1 hour to play it.': 'При пристигане водите битката сами на ходове (иначе – автоматично). Имате 1 час да я изиграете.',
  'On the road': 'На път',
  'One group of settlers sets out; you can send an escort too – it stays in the new city.': 'Тръгват едни заселници; можете да изпратите и охрана – тя остава в новия град.',
  'Online': 'Онлайн',
  'Online ({0})': 'На линия ({0})',
  'Online against {0} · {1} · {2} moves': 'Онлайн срещу {0} · {1} · {2} хода',
  'Online against {0} · {1}:{2}': 'Онлайн срещу {0} · {1}:{2}',
  'Online against {0} · {1}:{2} · to {3}': 'Онлайн срещу {0} · {1}:{2} · до {3}',
  'Online now': 'На линия',
  'Online on the portal': 'На линия в портала',
  'Online race · {0}/52 cards · {1}': 'Онлайн състезание · {0}/52 карти · {1}',
  'Online world: all players share one world and the server checks every action.': 'Онлайн свят: всички играчи са в един свят, а сървърът проверява всяко действие.',
  'Online · abandoned match': 'Онлайн · изоставен мач',
  'Online · left match': 'Онлайн · напуснат мач',
  'Online · resigned': 'Онлайн · предаване',
  'Online · with {0} · {1}:{2} · to {3}': 'Онлайн · с {0} · {1}:{2} · до {3}',
  'Online · {0}': 'Онлайн · {0}',
  'Online · {0} players · winner {1}': 'Онлайн · {0} играчи · победител {1}',
  'Only the hero goes on an adventure.': 'На приключение тръгва само героят.',
  'Only the leader can kick members.': 'Само водачът може да изключва.',
  'Only the leader sets the diplomacy.': 'Само водачът определя дипломацията.',
  'Open rooms': 'Отворени стаи',
  'Open the game from the new icon – full screen, like an app. Evil Empires notifications only work this way.': 'Отваряйте играта от новата икона – на цял екран, като приложение. Известията на Evil Empires работят само така.',
  'Open the site in Safari.': 'Отворете сайта в Safari.',
  'Opponent': 'Противник',
  'Opponent found: {0}!': 'Намерен противник: {0}!',
  'Orcs': 'Орки',
  'Outside the world.': 'Извън света.',
  'Overall': 'Общо',
  'Overview of the portal, players, reports and the Evil Empires world.': 'Преглед на портала, играчи, жалби и светът на Evil Empires.',
  'Pact': 'Пакт',
  'Pact with {0}.': 'Пакт с {0}.',
  'Pact · {0} gold': 'Пакт · {0} злато',
  'Paladin': 'Паладин',
  'Palisade': 'Палисада',
  'Pass': 'Пас',
  'Password': 'Парола',
  'Petar': 'Петър',
  'Pieces': 'Фигури',
  'Pikeman': 'Пикинер',
  'Pikes': 'Пики',
  'Plain': 'Равнина',
  'Plate Armor': 'Плочеста броня',
  'Play': 'Играй',
  'Play against real people. Create a room and send the link to a friend, or join an open room.': 'Играйте срещу реални хора. Създайте стая и изпратете връзката на приятел или влезте в отворена стая.',
  'Play to': 'Игра до',
  'Played': 'Изиграни',
  'Player': 'Играч',
  'Player 1': 'Играч 1',
  'Player 2': 'Играч 2',
  'Player 3': 'Играч 3',
  'Player 4': 'Играч 4',
  'Player name…': 'Име на играч…',
  'Players': 'Играчи',
  'Points': 'Точки',
  'Points in the deal': 'Точки в раздаването',
  'Population': 'Население',
  'Population (room for troops)': 'Население (място за войска)',
  'Population: {0}': 'Население: {0}',
  'Private': 'Лични',
  'Produces food for the population and the army.': 'Произвежда храна за населението и войската.',
  'Profile': 'Профил',
  'Protects part of every resource from plunder.': 'Пази част от всеки ресурс от грабеж.',
  'Protects {0} of each resource': 'Пази по {0} от ресурс',
  'Quarry': 'Кариера',
  'Quarte': 'Кварта',
  'Quick game': 'Бърза игра',
  'Quint': 'Квинта',
  'RESET': 'РЕСТАРТ',
  'Raid: {0} (level {1})': 'Набег: {0} (ниво {1})',
  'Random': 'Случайно',
  'Ranking': 'Класация',
  'Ranking of alliances': 'Класация на съюзите',
  'Ranking of rulers': 'Класация на владетелите',
  'Rating': 'Рейтинг',
  'Reaction': 'Реакция',
  'Rear': 'Отзад',
  'Reason': 'Причина',
  'Reason (the player sees it)': 'Причина (вижда я играчът)',
  'Reason: ': 'Причина: ',
  'Received': 'Получени',
  'Recent games': 'Последни игри',
  'Recovery': 'Възстановяване',
  'Red': 'Червени',
  'Redouble!': 'Реконтра!',
  'Registered': 'Регистриран',
  'Reinforcement for {0}': 'Подкрепа за {0}',
  'Reinforcements can only be sent to alliance members.': 'Подкрепления се пращат само на членове на съюза.',
  'Reinforcements from allies': 'Подкрепления от съюзници',
  'Reinforcements with allies': 'Подкрепления при съюзници',
  'Relations': 'Отношения',
  'Rematch': 'Реванш',
  'Remove': 'Премахни',
  'Remove {0} from your friends?': 'Да премахнете ли {0} от приятелите?',
  'Removing': 'Премахване',
  'Rename': 'Преименувай',
  'Repeat the password': 'Повторете паролата',
  'Repel an attack': 'Отбийте нападение',
  'Report': 'Жалба',
  'Report a message from {0}': 'Жалба за съобщение от {0}',
  'Report the message': 'Жалба за съобщението',
  'Reports': 'Доклади',
  'Reports are not enabled on the server yet.': 'Жалбите още не са включени на сървъра.',
  'Request sent': 'Заявката е изпратена',
  'Requests{0}': 'Заявки{0}',
  'Required for the Age of Kingdoms (coming soon)': 'Нужно за Епохата на кралствата (скоро)',
  'Required for the Bronze Age': 'Нужно за Бронзовата епоха',
  'Required for the Iron Age': 'Нужно за Желязната епоха',
  'Requires the technology "{0}".': 'Нужна е технологията „{0}“.',
  'Requires: ': 'Нужно: ',
  'Requires: {0} level {1}.': 'Нужно е: {0} ниво {1}.',
  'Research': 'Изследвай',
  'Research "{0}"': 'Изследване „{0}“',
  'Research Bronze Casting': 'Изследвайте Бронзолеене',
  'Research Horse Riding': 'Изследвайте Езда',
  'Research Steel': 'Изследвайте Стомана',
  'Research is 20% slower': 'Изследванията са с 20% по-бавни',
  'Research started.': 'Изследването започна.',
  'Research −{0}%': 'Изследвания −{0}%',
  'Researched: {0}.': 'Изследвано: {0}.',
  'Researches technologies. Each level speeds up research by 5%.': 'Изследва технологии. Всяко ниво ускорява изследванията с 5%.',
  'Reset': 'Рестартирай',
  'Reset the Evil Empires world': 'Рестарт на света на Evil Empires',
  'Reset the world': 'Рестарт на света',
  'Resign': 'Предай се',
  'Resigned · {0} players': 'Предаване · {0} играчи',
  'Resources': 'Ресурси',
  'Result': 'Резултат',
  'Returned: {0}': 'Върна: {0}',
  'Returning': 'Връщане',
  'Reveals the approximate number': 'Разкрива приблизителния брой',
  'Reveals the exact makeup': 'Разкрива точния състав',
  'Reveals the troop types': 'Разкрива видовете войски',
  'Revival': 'Съживяване',
  'Revive {0}': 'Съживете {0}',
  'Revive · {0}': 'Съживи · {0}',
  'Reviving': 'Съживява се',
  'River': 'Река',
  'Roll': 'Хвърли',
  'Rolling for the first move…': 'Хвърляне за първи ход…',
  'Room code': 'Код на стая',
  'Room {0}': 'Стая {0}',
  'Rotten Darg': 'Гнилия Дарг',
  'Ruins': 'Руини',
  'Ruler': 'Владетел',
  'Ruler: {0}': 'Владетел: {0}',
  'Rules': 'Правила',
  'Rules – {0}': 'Правила – {0}',
  'Rusty Sword': 'Ръждясал меч',
  'Santase': 'Сантасе',
  'Save': 'Запази',
  'Sawmill': 'Дъскорезница',
  'Science': 'Наука',
  'Scout': 'Съгледвач',
  'Scout a foreign city': 'Разузнайте чужд град',
  'Scout a target': 'Разузнайте цел',
  'Scouted {0} ago': 'Разузнато преди {0}',
  'Scouting': 'Разузнаване',
  'Scouting: {0}': 'Разузнаване: {0}',
  'Scouts and settlers do not fight.': 'Съгледвачите и заселниците не се бият.',
  'Scouts lost: {0}': 'Загубени съгледвачи: {0}',
  'Search': 'Търсене',
  'Search by name…': 'Търсене по име…',
  'Seat 1': 'Място 1',
  'Seat 2': 'Място 2',
  'Seat 3': 'Място 3',
  'Sees approaching attacks from farther away and reveals their makeup. The tower\'s archers give +2% defense per level.': 'Вижда приближаващите се нападения по-отдалеч и разкрива състава им. Стрелците на кулата дават +2% защита на ниво.',
  'Sees attacks {0} before arrival': 'Вижда нападенията {0} преди пристигане',
  'Select a green tile to move.': 'Изберете зелено поле, за да се придвижите.',
  'Select a tile on the map.': 'Изберете поле на картата.',
  'Select an enemy (red) to attack.': 'Изберете враг (червено), за да атакувате.',
  'Select one of your units. The forest protects from arrows, the hill gives range and defense, the ruins – cover. Archers shoot 3 tiles; cavalry moves 4. The hero inspires neighbours (+10%).': 'Изберете своя единица. Гората пази от стрели, хълмът дава обсег и защита, руините – прикритие. Стрелците стрелят на 3 полета; конницата се движи на 4. Героят вдъхновява съседите (+10%).',
  'Sell': 'Продай',
  'Sell for {0} gold and {1} souls': 'Продай за {0} злато и {1} души',
  'Send': 'Изпрати',
  'Send away': 'Отпрати',
  'Send only scouts.': 'Изпратете само съгледвачи.',
  'Send the hero on 2 adventures': 'Изпратете героя на 2 приключения',
  'Send the hero on an adventure': 'Изпратете героя на приключение',
  'Send the hero on an adventure – they will return with experience and maybe with loot.': 'Изпратете героя на приключение – ще се върне с опит, а може би и с плячка.',
  'Send the report': 'Изпрати жалбата',
  'Sent': 'Изпратени',
  'Server error.': 'Грешка от сървъра.',
  'Set out': 'Тръгвай',
  'Settings and sound': 'Настройки и звук',
  'Settlers': 'Заселници',
  'Settlers are required.': 'Нужни са заселници.',
  'Settlers cannot reinforce.': 'Заселниците не могат да подкрепят.',
  'Settlers required (Citadel 5)': 'Нужни са заселници (Цитадела 5)',
  'Shadow': 'Сянка',
  'Show': 'Покажи',
  'Showing the players registered on this device.': 'Показват се играчите, регистрирани на това устройство.',
  'Siege': 'Обсада',
  'Sign up': 'Регистрация',
  'Silent Stoyan': 'Мълчаливия Стоян',
  'Silver Knight': 'Сребърен рицар',
  'Silver Talisman': 'Сребърен талисман',
  'Sisters of the Mist': 'Сестрите на мъглата',
  'Sit here': 'Седни тук',
  'Sixty-six – a quick game for two.': 'Шейсет и шест – бърза игра за двама.',
  'Skeleton': 'Скелет',
  'Skills': 'Умения',
  'Skip the tutorial': 'Пропусни обучението',
  'Slinger': 'Прашкар',
  'Slings': 'Прашки',
  'Slow': 'Бавно',
  'Slow growth (−15% population)': 'Бавен растеж (−15% население)',
  'Smithing': 'Ковачество',
  'Smithy': 'Ковачница',
  'Sold.': 'Продадено.',
  'Solitaire': 'Пасианс',
  'Solo · progress over months': 'Сам · прогрес с месеци',
  'Solved in {0} · {1} moves · {2}': 'Наредена за {0} · {1} хода · {2}',
  'Solved!': 'Наредено!',
  'Sort all the cards by suit from ace to king.': 'Подредете всички карти по бои от асо до поп.',
  'Sort by:': 'Подреди по:',
  'Souls': 'Души',
  'Sound': 'Звук',
  'Sound (music, city, battles)': 'Звук (музика, град, битки)',
  'South': 'Юг',
  'Spades': 'Пика',
  'Spearman': 'Копиеносец',
  'Spears': 'Копия',
  'Speed': 'Скорост',
  'Speed (only for tests on the local server)': 'Скорост (само за тестове на локалния сървър)',
  'Speed (tiles per hour)': 'Скорост (полета на час)',
  'Spiker': 'Бодливец',
  'Stables': 'Конюшня',
  'Stables required.': 'Нужна е Конюшня.',
  'Stalemate': 'Пат',
  'Start 3 constructions': 'Започнете 3 строежа',
  'Start 5 constructions': 'Започнете 5 строежа',
  'Start over': 'Започни отначало',
  'Start the game': 'Започни играта',
  'Start the match': 'Започни мача',
  'Steel': 'Стомана',
  'Steel Ranks': 'Стоманени редици',
  'Steppe Horse': 'Степен кон',
  'Steward': 'Стопанин',
  'Stone': 'Камък',
  'Stone Walls': 'Каменни стени',
  'Stone by Stone': 'Камък по камък',
  'Storage: {0}': 'Склад: {0}',
  'Strategy: raise an empire through the ages.': 'Стратегия: издигнете империя през епохите.',
  'Strength': 'Сила',
  'Strength at home': 'Сила у дома',
  'Stronghold': 'Твърдина',
  'Supplies': 'Запаси',
  'Synchronization error': 'Грешка в синхронизацията',
  'Synchronization error – the game was stopped.': 'Грешка в синхронизацията – играта е прекратена.',
  'Synchronization error – the match was stopped.': 'Грешка в синхронизацията – мачът е прекратен.',
  'TAPA': 'ТАПА',
  'Tactical battle': 'Тактическа битка',
  'Tag': 'Таг',
  'Taken': 'Отнесено',
  'Talk to all the players on the portal and find an opponent with one tap.': 'Говорете с всички играчи на портала и намерете противник с едно натискане.',
  'Tap the "Share" button ': 'Натиснете бутона „Сподели“ ',
  'Tapa': 'Тапа',
  'Team A · north': 'Отбор А · север',
  'Team A · south': 'Отбор А · юг',
  'Team B · east': 'Отбор Б · изток',
  'Team B · west': 'Отбор Б · запад',
  'Temple': 'Храм',
  'Temple of the Ancestors': 'Храмът на прадедите',
  'Terrain: {0}': 'Терен: {0}',
  'Terror of the Steppe': 'Ужасът на степта',
  'Test mode. ': 'Тестов режим. ',
  'The 3D libraries did not load': '3D библиотеките не се заредиха',
  'The Ash Viper': 'Пепелянката',
  'The Ashen': 'Пепелните',
  'The Blood Crescent': 'Кървавият полумесец',
  'The Citadel Grows': 'Цитаделата расте',
  'The Empire of {0}': 'Империята на {0}',
  'The Evil Empires server (Supabase Edge Function) must be deployed – see the README.': 'Сървърът на Evil Empires (Supabase Edge Function) трябва да е качен – виж README.',
  'The First Science': 'Първата наука',
  'The First Warriors': 'Първите воини',
  'The Hero': 'Героят',
  'The Hero\'s Path': 'Пътят на героя',
  'The Last Warlord': 'Последният вожд',
  'The Legacy': 'Наследството',
  'The Nameless': 'Безименния',
  'The Night Wolves': 'Нощните вълци',
  'The Rifts': 'Разломите',
  'The Secret of Bronze': 'Тайната на бронза',
  'The Spring': 'Изворът',
  'The Voice of War': 'Гласът на войната',
  'The Wolf Khan': 'Вълчия хан',
  'The academy is busy.': 'Академията е заета.',
  'The account is banned until {0}{1}.': 'Акаунтът е блокиран до {0}{1}.',
  'The account is banned.': 'Акаунтът е блокиран.',
  'The adventure is gone.': 'Приключението вече го няма.',
  'The alliance is founded!': 'Съюзът е основан!',
  'The alliance is full.': 'Съюзът е пълен.',
  'The army awaits orders. If you don\'t play the battle in time, it will be decided automatically.': 'Войската чака заповед. Ако не изиграете битката навреме, тя ще се реши автоматично.',
  'The army does not eat': 'Войската не яде',
  'The army has reached {0} – lead the battle!': 'Войската пристигна при {0} – поведете битката!',
  'The army is going home.': 'Войската се прибира.',
  'The army returned to {0}.': 'Войската се върна в {0}.',
  'The army set out.': 'Войската потегли.',
  'The attack on {0} failed.': 'Атаката срещу {0} се провали.',
  'The attack was repelled': 'Нападението е отбито',
  'The attacker has no room for a new city.': 'Нападателят няма място за нов град.',
  'The ban has been lifted.': 'Блокирането е премахнато.',
  'The barbarian rulers will be able to attack you. Are you sure?': 'Варварските владетели ще могат да ви нападат. Сигурни ли сте?',
  'The battle is already decided.': 'Битката вече е решена.',
  'The battle is decided.': 'Битката е решена.',
  'The battle is over.': 'Битката приключи.',
  'The battle was fought on the tactical map.': 'Битката е проведена на тактическата карта.',
  'The beasts have been driven away.': 'Зверовете са прогонени.',
  'The best players on the portal.': 'Най-добрите играчи в портала.',
  'The browser does not support notifications.': 'Браузърът не поддържа известия.',
  'The builders are busy.': 'Строителите са заети.',
  'The building "{0}" is required.': 'Нужна е сградата „{0}“.',
  'The camp is destroyed – the barbarians are still gathering.': 'Лагерът е разбит – варварите още се събират.',
  'The campaign for this version is complete. New chapters are coming!': 'Кампанията за тази версия е завършена. Очаквайте нови глави!',
  'The capital cannot be conquered.': 'Столицата не може да бъде завладяна.',
  'The chat is not enabled on the server yet.': 'Чатът още не е включен на сървъра.',
  'The city was plundered': 'Градът е ограбен',
  'The clan will not attack you for 3 days': 'Кланът няма да ви напада 3 дни',
  'The classic for 2–4 players – with a 3D die.': 'Класиката за 2–4 играчи – с 3D зар.',
  'The computer is thinking…': 'Компютърът мисли…',
  'The connection to the server was lost.': 'Връзката със сървъра прекъсна.',
  'The current game will be stopped without being counted. Continue?': 'Текущата игра ще бъде прекратена без да се отчита. Продължаване?',
  'The current game will count as a loss. Continue?': 'Текущата игра ще се отчете като загуба. Продължаване?',
  'The current match will be stopped without being counted. Continue?': 'Текущият мач ще бъде прекратен без да се отчита. Продължаване?',
  'The dashboard is not enabled on the server yet (run supabase/admin.sql).': 'Таблото още не е включено на сървъра (изпълнете supabase/admin.sql).',
  'The edge of the world': 'Краят на света',
  'The empire': 'Империята',
  'The empire entered the {0}!': 'Империята навлезе в {0}!',
  'The empire is already entering a new age.': 'Империята вече преминава в нова епоха.',
  'The empire is entering a new age!': 'Империята навлиза в нова епоха!',
  'The enemy': 'Врагът',
  'The enemy\'s strength is unknown – scout first.': 'Силата на врага е неизвестна – разузнайте първо.',
  'The game could not load: ': 'Играта не можа да се зареди: ',
  'The game will count as a loss. Continue?': 'Играта ще се отчете като загуба. Продължаване?',
  'The heart of the city. Its level limits the other buildings, speeds up construction and allows new cities.': 'Сърцето на града. Нивото ѝ ограничава останалите сгради, ускорява строежа и позволява нови градове.',
  'The hero': 'Героят',
  'The hero is alive.': 'Героят е жив.',
  'The hero is already being revived.': 'Героят вече се съживява.',
  'The hero is in {0} – switch to that city to send them.': 'Героят е в {0} – превключете към този град, за да го изпратите.',
  'The hero is not in this city': 'Героят не е в този град',
  'The hero is not in this city.': 'Героят не е в този град.',
  'The hero is returning': 'Героят се връща',
  'The hero is too badly wounded.': 'Героят е твърде ранен.',
  'The hero is waiting for their first adventure – it appears in a minute. Meanwhile, look around the "Hero" tab.': 'Героят чака първото си приключение – появява се след минута. Междувременно огледайте раздел „Герой“.',
  'The hero must be at home.': 'Героят трябва да е у дома.',
  'The hero recovers +{0}%/h faster here': 'Героят се възстановява +{0}%/ч по-бързо тук',
  'The hero set out.': 'Героят потегли.',
  'The hero will return with experience and maybe with loot.': 'Героят ще се върне с опит и може би с плячка.',
  'The invitation has been sent.': 'Поканата е изпратена.',
  'The invitation is no longer valid.': 'Поканата вече не е валидна.',
  'The invitation to {0} has been sent.': 'Поканата до {0} е изпратена.',
  'The link has been copied.': 'Връзката е копирана.',
  'The match could not start – one of the players did not respond.': 'Мачът не можа да започне – някой от играчите не отговори.',
  'The match has already started': 'Мачът вече е започнал',
  'The match is starting…': 'Мачът започва…',
  'The match was changed in the meantime – try again.': 'Мачът беше променен междувременно – опитайте отново.',
  'The message was deleted.': 'Съобщението е изтрито.',
  'The mission is not complete yet.': 'Мисията още не е изпълнена.',
  'The new city is yours. Switch to it from the top bar.': 'Новият град е ваш. Превключете към него от горната лента.',
  'The next age comes in a new version of the game.': 'Следващата епоха идва в нова версия на играта.',
  'The oasis ({0}|{1}) is yours: +25% {2} for {3}.': 'Оазисът ({0}|{1}) е ваш: +25% {2} за {3}.',
  'The oasis is already taken': 'Оазисът вече е зает',
  'The oasis is already yours.': 'Оазисът вече е ваш.',
  'The oasis is held by another player.': 'Оазисът е владян от друг играч.',
  'The oasis is more than {0} tiles from {1}.': 'Оазисът е на повече от {0} полета от {1}.',
  'The online world is not available': 'Онлайн светът не е достъпен',
  'The opponent declined the draw.': 'Противникът отказа ремито.',
  'The opponent left': 'Противникът напусна',
  'The opponent left – forfeit win.': 'Противникът напусна – служебна победа.',
  'The opponent wants a rematch.': 'Противникът иска реванш.',
  'The opponents are inside!': 'Противниците са вътре!',
  'The opponents won the game.': 'Противниците изкараха играта.',
  'The pact stops the clan\'s attacks against you, but you cannot attack them either.': 'Пактът спира нападенията на клана срещу вас, но и вие не можете да ги нападате.',
  'The password must be at least 6 characters.': 'Паролата трябва да е поне 6 символа.',
  'The passwords don\'t match.': 'Паролите не съвпадат.',
  'The player is already in an alliance.': 'Играчът вече е в съюз.',
  'The player is banned.': 'Играчът е блокиран.',
  'The player is under beginner protection.': 'Играчът е под защита за новаци.',
  'The portal has no online server, so online play only works between tabs of this browser (log in with a different user in each tab). ': 'Порталът е без онлайн сървър, затова онлайн игра работи само между раздели на този браузър (влезте с различен потребител във всеки раздел). ',
  'The profile has been updated.': 'Профилът е обновен.',
  'The reinforcements arrived at {0}.': 'Подкрепленията пристигнаха при {0}.',
  'The reinforcements arrived in {0}.': 'Подкрепленията пристигнаха в {0}.',
  'The reinforcements will go home.': 'Подкрепленията ще се приберат.',
  'The report has been sent to the administrators.': 'Жалбата е изпратена на администраторите.',
  'The request has been sent.': 'Заявката е изпратена.',
  'The result was not saved: ': 'Резултатът не беше записан: ',
  'The revival has started.': 'Съживяването започна.',
  'The reward has already been claimed.': 'Наградата вече е взета.',
  'The reward is yours!': 'Наградата е ваша!',
  'The scouts at {0} were killed.': 'Съгледвачите при {0} бяха избити.',
  'The scouts failed.': 'Съгледвачите не успяха.',
  'The scouts scouted {0}.': 'Съгледвачите разузнаха {0}.',
  'The scouts were discovered': 'Съгледвачите бяха разкрити',
  'The server is busy – try again.': 'Сървърът е зает – опитайте отново.',
  'The shared seed check failed.': 'Неуспешна проверка на общия seed.',
  'The site for the new city is taken – the settlers are returning.': 'Мястото за новия град е заето – заселниците се връщат.',
  'The spot is taken.': 'Мястото е заето.',
  'The surviving kingdoms after the Fall – stubborn builders and traders.': 'Оцелелите кралства след Падението – упорити строители и търговци.',
  'The training queue is full.': 'Опашката за обучение е пълна.',
  'The tutorial is complete – the empire is yours! 👑': 'Обучението е завършено – империята е ваша! 👑',
  'The world has been reset.': 'Светът е рестартиран.',
  'Their scouts cannot be detected': 'Съгледвачите им не могат да бъдат засечени',
  'Them': 'Те',
  'There are no other rulers in the world': 'Няма други владетели в света',
  'There is already a march to this camp.': 'Към този лагер вече има поход.',
  'There is no oasis here.': 'Тук няма оазис.',
  'They found a new city. Cities: {0} / {1} (one more for every 5 Citadel levels).': 'Основават нов град. Градове: {0} / {1} (още един на всеки 5 нива на Цитаделата).',
  'This account was created on a secure address (localhost/https). Open the portal from there to log in.': 'Този акаунт е създаден на защитен адрес (localhost/https). Отворете портала оттам, за да влезете.',
  'This game has no referee.': 'Тази игра няма съдия.',
  'This tag is taken.': 'Този таг е зает.',
  'This username is already taken.': 'Това потребителско име вече е заето.',
  'Three players · with bots or online': 'Трима · с ботове или онлайн',
  'Threefold repetition': 'Трикратно повторение',
  'Thrower': 'Хвърлач',
  'Tierce': 'Терца',
  'Time': 'Време',
  'Time played': 'Време в игра',
  'Time played (this session)': 'Време в игра (тази сесия)',
  'Time {0}, {1} moves.': 'Време {0}, {1} хода.',
  'To conquer the oasis, send the hero as well.': 'За да завладеете оазиса, изпратете и героя.',
  'To play with people on other devices, set up a free Supabase – the steps are in README.md.': 'За игра с хора от други устройства настройте безплатен Supabase – стъпките са в README.md.',
  'To the city': 'Към града',
  'To the empire': 'Към империята',
  'To the games': 'Към игрите',
  'To the lobby': 'Към лобито',
  'To the {0} · {1}': 'Към {0} · {1}',
  'Too fast': 'Твърде',
  'Too fast – wait a moment.': 'Твърде бързо – изчакайте малко.',
  'Too many reports – try again later.': 'Твърде много жалби – опитайте по-късно.',
  'Total time': 'Общо време',
  'Tournament': 'Турнир',
  'Tracker': 'Следотърсач',
  'Trade': 'Търговия',
  'Train': 'Обучи',
  'Train 10 units': 'Обучете 10 единици',
  'Train 5 units': 'Обучете 5 единици',
  'Train at least 5 soldiers in the "Army" tab.': 'Обучете поне 5 войници в раздел „Армия“.',
  'Trained: {0} × {1}.': 'Обучени: {0} × {1}.',
  'Training': 'Обучение',
  'Training started.': 'Обучението започна.',
  'Training −{0}%': 'Обучение −{0}%',
  'Trains berserkers. Each level speeds up troop training by 5%.': 'Обучава берсерки. Всяко ниво ускорява обучението на войска с 5%.',
  'Trains heavy cavalry. Each level speeds up cavalry training by 5%.': 'Обучава тежка конница. Всяко ниво ускорява обучението на конницата с 5%.',
  'Trains troops. Each level speeds up training by 4%.': 'Обучава войска. Всяко ниво ускорява обучението с 4%.',
  'Traps': 'Капани',
  'Trebuchet': 'Требушет',
  'Tricks taken': 'Взети ръце',
  'Troops': 'Войска',
  'Troops: +{0}% attack and defense': 'Войската: +{0}% атака и защита',
  'Trumps {0} {1}': 'Коз {0} {1}',
  'Trumps: {0} {1}': 'Коз: {0} {1}',
  'Turn sound off': 'Изключи звука',
  'Turn sound on': 'Включи звука',
  'Turn {0} of {1}': 'Ход {0} от {1}',
  'Tutorial · step {0} of {1}': 'Обучение · стъпка {0} от {1}',
  'Twenty!': 'Двайсет!',
  'Type RESET to confirm.': 'Напишете RESET за потвърждение.',
  'Type RESET to confirm:': 'Напишете RESET за потвърждение:',
  'Unban': 'Отблокирай',
  'Undead': 'Немъртви',
  'Under the Banners': 'Под знамената',
  'Undo': 'Върни',
  'Unequip': 'Свали',
  'Unfinished online match': 'Незавършен онлайн мач',
  'Units are 20% cheaper': 'Единиците са с 20% по-евтини',
  'Units are 20% more expensive': 'Единиците са с 20% по-скъпи',
  'Unknown action.': 'Непознато действие.',
  'Unknown march.': 'Непознат поход.',
  'Unknown race.': 'Непозната раса.',
  'Unknown request.': 'Непозната заявка.',
  'Unknown strength – build a Watchtower.': 'Неизвестна сила – постройте Стражева кула.',
  'Unknown target.': 'Непозната цел.',
  'Unlocks bow archers': 'Отключва стрелци с лък',
  'Unlocks catapults – they destroy walls and buildings (requires Barracks level 5)': 'Отключва катапулти – рушат стени и сгради (нужна е казарма ниво 5)',
  'Unlocks cavalry (requires Barracks level 3)': 'Отключва конница (нужна е казарма ниво 3)',
  'Unlocks crossbowmen': 'Отключва арбалетчици',
  'Unlocks heavy cavalry (requires Stables)': 'Отключва тежка конница (нужна е Конюшня)',
  'Unlocks in the {0}.': 'Отключва се в {0}.',
  'Unlocks noblemen – they lower loyalty and conquer cities (Citadel 10)': 'Отключва благородници – снижават лоялността и завладяват градове (Цитадела 10)',
  'Unlocks pikemen': 'Отключва пикинери',
  'Unlocks scouts': 'Отключва съгледвачи',
  'Unlocks slingers': 'Отключва стрелци с прашка',
  'Unlocks spearmen (strong against cavalry)': 'Отключва копиеносци (силни срещу конница)',
  'Unlocks the Altar and mana': 'Отключва Олтара и маната',
  'Upgrade the Citadel first.': 'Първо подобрете Цитаделата.',
  'Upgrade to {0}': 'Подобри до {0}',
  'Upkeep': 'Издръжка',
  'Upkeep (food per hour)': 'Издръжка (храна на час)',
  'Us': 'Ние',
  'Username': 'Потребителско име',
  'Username…': 'Потребителско име…',
  'Velmira the Dark': 'Велмира Тъмната',
  'Victory': 'Победа',
  'Victory over {0} (level {1})!': 'Победа над {0} (ниво {1})!',
  'Victory!': 'Победа!',
  'Vorg the Ashen': 'Ворг Пепелния',
  'WLF': 'ВЪЛ',
  'Waiting for the host to start.': 'Чакаме домакина да започне.',
  'Waiting for the other players to accept the rematch…': 'Чакаме другите играчи да приемат реванша…',
  'Wall': 'Стена',
  'Wall level {0}': 'Стена ниво {0}',
  'War Stallion': 'Боен жребец',
  'Warden': 'Пазител',
  'Warehouse': 'Склад',
  'Warehouse level 2': 'Склад ниво 2',
  'Warlord': 'Вожд',
  'Warlord of the Ashlands': 'Вождът на пепелищата',
  'Warlord\'s Camp': 'Лагер на вожда',
  'Warlord\'s Sword': 'Меч на вожда',
  'Watchtower': 'Стражева кула',
  'We Held!': 'Удържахме!',
  'Weapon': 'Оръжие',
  'Welcome back': 'Добре дошли отново',
  'Welcome, ruler': 'Добре дошли, владетелю',
  'Welcome, {0}!': 'Добре дошли, {0}!',
  'West': 'Запад',
  'While you were away': 'Докато ви нямаше',
  'White': 'Белите',
  'Wickedly': 'Зловещо',
  'Win 2 raids': 'Спечелете 2 набега',
  'Win a raid': 'Спечелете набег',
  'Win a tactical battle': 'Спечелете тактическа битка',
  'Win rate': 'Успеваемост',
  'Wins': 'Победи',
  'Witcher': 'Вещер',
  'Witcher\'s Eye': 'Окото на вещера',
  'Witchers': 'Вещери',
  'Witchers\' Tower': 'Кула на вещерите',
  'Withdraw': 'Изтегли',
  'Wolf Pack': 'Глутница',
  'Wolf Rider': 'Вълчи ездач',
  'Wood': 'Дърво',
  'Wood for the Winter': 'Дърва за зимата',
  'Wooden': 'Дървени',
  'Wounds: −{0}% health': 'Рани: −{0}% живот',
  'Wraith': 'Призрак',
  'Write the first message.': 'Напишете първото съобщение.',
  'Write to everyone on the portal…': 'Пишете на всички в портала…',
  'Write to everyone…': 'Пишете на всички…',
  'Write to the alliance…': 'Пишете на съюза…',
  'Wrong username or password.': 'Грешно потребителско име или парола.',
  'Yellow': 'Жълти',
  'Yes': 'Да',
  'You': 'Вие',
  'You against Georgi and Petar. The dealer takes 8 tricks, the next player 5, the third 3.': 'Вие срещу Георги и Петър. Раздаващият взема 8 ръце, следващият 5, третият 3.',
  'You already have an empire.': 'Вече имате империя.',
  'You and Maria against Georgi and Petar.': 'Вие и Мария срещу Георги и Петър.',
  'You are already in an alliance.': 'Вече сте в съюз.',
  'You are not at the table.': 'Не сте на масата.',
  'You are not in an alliance.': 'Не сте в съюз.',
  'You are not in an alliance. Join or found one in the "Alliance" tab (an Embassy is required).': 'Не сте в съюз. Присъединете се или основете съюз в раздела „Съюз“ (нужно е Посолство).',
  'You are not logged in.': 'Не сте влезли.',
  'You are now friends!': 'Вече сте приятели!',
  'You are now in {0}!': 'Вече сте в {0}!',
  'You are ready. The match starts when the host presses "Start".': 'Готови сте. Мачът започва, когато домакинът натисне „Започни“.',
  'You are the host. Invite a friend with the link.': 'Вие сте домакин. Поканете приятел с връзката.',
  'You can found an alliance': 'Може да основете съюз',
  'You can\'t': 'Не можете',
  'You cannot attack allies.': 'Не можете да нападате съюзници.',
  'You cannot ban yourself.': 'Не можете да блокирате себе си.',
  'You conquered {0}!': 'Завладяхте {0}!',
  'You don\'t have administrator rights.': 'Нямате права на администратор.',
  'You don\'t have an empire.': 'Нямате империя.',
  'You don\'t have that many troops in this city.': 'Нямате толкова войска в този град.',
  'You finished first! Time {0}.': 'Наредихте пръв! Време {0}.',
  'You founded a new city: {0}!': 'Основахте нов град: {0}!',
  'You gave up the race.': 'Отказахте се от състезанието.',
  'You give': 'Вие давате',
  'You got all your pieces home first!': 'Изкарахте всичките си пулове първи!',
  'You have a pact with this clan.': 'Имате пакт с този клан.',
  'You have an online match in progress. Go back before your opponent gets a forfeit win.': 'Имате започнат онлайн мач. Върнете се, преди противникът да получи служебна победа.',
  'You have logged out.': 'Излязохте от профила си.',
  'You have no': 'Нямате',
  'You have no finished games yet.': 'Все още нямате завършени игри.',
  'You have no free oasis slot – upgrade the Hall of Heroes (level 3, 6, 10).': 'Нямате свободно място за оазис – подобрете Залата на героите (ниво 3, 6, 10).',
  'You have no free points.': 'Нямате свободни точки.',
  'You have no friends yet – add them from "Friends".': 'Още нямате приятели – добавете ги от „Приятели“.',
  'You have no friends yet. Find players by username in "Find players".': 'Още нямате приятели. Намерете играчи по потребителско име в „Намери играчи“.',
  'You have no private conversations.': 'Нямате лични разговори.',
  'You have no room for a new city – upgrade the Citadel.': 'Нямате място за нов град – подобрете Цитаделата.',
  'You have no scouts in this city': 'Нямате съгледвачи в този град',
  'You have no suitable troops in this city.': 'Нямате подходяща войска в този град.',
  'You invited {0}.': 'Поканихте {0}.',
  'You offered a draw.': 'Предложихте реми.',
  'You play': 'Играете с',
  'You play red. Bring your four pieces home before the others.': 'Вие сте с червените. Изкарайте четирите си пула до дома преди другите.',
  'You play white and move towards the bottom right corner.': 'Вие сте с белите пулове и местите към долния десен ъгъл.',
  'You plundered {0}!': 'Ограбихте {0}!',
  'You reached {0} first!': 'Стигнахте {0} първи!',
  'You resigned the game.': 'Предадохте играта.',
  'You resigned the match.': 'Предадохте мача.',
  'You rolled': 'Хвърлихте',
  'You rolled {0}. Choose a checker.': 'Хвърлихте {0}. Изберете пул.',
  'You take': 'Вие вземате',
  'You will get back 80% of the resources.': 'Ще получите обратно 80% от ресурсите.',
  'You will lose the race. Continue?': 'Ще загубите състезанието. Продължаване?',
  'You win the deal!': 'Печелите раздаването!',
  'You win the game{0} – +{1}': 'Печелите играта{0} – +{1}',
  'You won the game!': 'Изкарахте играта!',
  'You won the match!': 'Спечелихте мача!',
  'You\'re inside! The points go to the opponents.': 'Вътре сте! Точките отиват при противника.',
  'You: ': 'Вие: ',
  'Your bid': 'Вие обявявате',
  'Your defense: {0} · wall {1} · traps for {2} · hideout {3}': 'Защитата ви: {0} · стена {1} · капани за {2} · скривалище {3}',
  'Your empire is not in the world yet.': 'Империята ви още не е в света.',
  'Your hero is already waiting for adventures. For the first {0} you are under beginner protection – nobody will attack you.': 'Героят ви вече чака приключения. Първите {0} сте под защита за новаци – никой няма да ви напада.',
  'Your marches': 'Вашите походи',
  'Your move': 'Вие сте на ход',
  'Your profile keeps your statistics and puts you in the ranking.': 'Профилът пази статистиката ви и ви поставя в класацията.',
  'Your team will lose the game. Continue?': 'Отборът ви ще загуби играта. Продължаване?',
  'Your turn – roll the dice.': 'Ваш ред – хвърлете заровете.',
  'Your turn – roll the die.': 'Ваш ред – хвърлете зара.',
  '[{0}] {1} · {2} members': '[{0}] {1} · {2} членове',
  'a bot takes over the seat': 'мястото се поема от бот',
  'a forfeit win for you': 'служебна победа за вас',
  'admin': 'админ',
  'adventure': 'приключение',
  'alliance ': 'съюз ',
  'allies': 'съюзници',
  'archers': 'стрелци',
  'arrives at {0}{1}': 'пристига в {0}{1}',
  'backgammon': 'табла',
  'barbarians · level {0}': 'варвари · ниво {0}',
  'bid {0} · tricks {1}:{2}': 'обяви {0} · ръце {1}:{2}',
  'blue': 'сини',
  'card': 'карта',
  'cards': 'карти',
  'cavalry': 'конница',
  'closed': 'затворено',
  'common': 'обикновен',
  'computer': 'компютър',
  'conquest': 'завладяване',
  'dangerous': 'опасно',
  'dice sound': 'звук на заровете',
  'disappears in {0}': 'изчезва след {0}',
  'draw.': 'реми.',
  'draws': 'реми',
  'e.g. ivan_88': 'напр. ivan_88',
  'epic': 'епичен',
  'food': 'храна',
  'for 1: ': 'за 1: ',
  'forever': 'завинаги',
  'free points: {0}': 'свободни точки: {0}',
  'games': 'игри',
  'gave up': 'отказа се',
  'green': 'зелени',
  'gulbara': 'гюлбара',
  'hero': 'герой',
  'infantry': 'пехота',
  'last trick taken': 'последна взета ръка',
  'legendary': 'легендарен',
  'level {0}': 'ниво {0}',
  'looking for {0}': 'търси {0}',
  'losses': 'загуби',
  'match to {0}': 'мач до {0}',
  'max {0}': 'макс {0}',
  'move': 'ход',
  'moves': 'хода',
  'neutral': 'неутрални',
  'new in ': 'нови след ',
  'non-aggression pact': 'пакт за ненападение',
  'none': 'няма',
  'not built': 'не е построена',
  'now': 'сега',
  'oasis ({0}|{1})': 'оазис ({0}|{1})',
  'offline': 'не е на линия',
  'online': 'онлайн',
  'online now': 'на линия',
  'ordinary': 'обикновено',
  'pact': 'пакт',
  'pact ': 'пакт ',
  'pact for ': 'пакт още ',
  'pips {0}': 'пипс {0}',
  'play to +{0}': 'игра до +{0}',
  'player': 'играч',
  'players': 'играчи',
  'playing {0}': 'играе {0}',
  'playing {0}{1}': 'играе {0}{1}',
  'point': 'точка',
  'points': 'точки',
  'points: you {0}{1} · {2} {3}': 'точки: вие {0}{1} · {2} {3}',
  'population': 'население',
  'rare': 'рядък',
  'rating': 'рейтинг',
  'red': 'червени',
  'scouting': 'разузнаване',
  'settling': 'заселване',
  'siege': 'обсада',
  'spears': 'копия',
  'tapa': 'тапа',
  'target': 'цел',
  'the closed stock didn\'t bring 66': 'затвореното тесте не донесе 66',
  'the computer': 'компютърът',
  'the target': 'целта',
  'to {0}': 'до {0}',
  'to {0}{1}': 'до {0}{1}',
  'under construction…': 'строи се…',
  'waiting': 'чака',
  'waiting for an answer': 'чака отговор',
  'waiting…': 'чака…',
  'wants to be friends': 'иска да сте приятели',
  'war': 'война',
  'war ': 'война ',
  'win rate': 'успех',
  'wins': 'победи',
  'yellow': 'жълти',
  'you': 'вие',
  'you ': 'вие ',
  'you continue': 'продължавате',
  'you start': 'започвате вие',
  'you win!': 'вие печелите!',
  'your alliance': 'вашият съюз',
  'your city': 'ваш град',
  '{0}\n…and {1} more': '{0}\n…и още {1}',
  '{0} (level {1}, health {2}%)': '{0} (ниво {1}, живот {2}%)',
  '{0} / {1} members': '{0} / {1} членове',
  '{0} [{1}] · {2} members': '{0} [{1}] · {2} членове',
  '{0} accepted the friend request.': '{0} прие поканата за приятелство.',
  '{0} active (15 min)': '{0} активни (15 мин)',
  '{0} after {1} moves.': '{0} след {1} хода.',
  '{0} again.': '{0} отново.',
  '{0} against the computer': '{0} срещу компютъра',
  '{0} attackers fell into the traps': 'В капаните попаднаха {0} нападатели',
  '{0} can\'t': '{0} не може',
  '{0} cards': '{0} карти',
  '{0} conquered {1}!': '{0} завладя {1}!',
  '{0} continues': '{0} продължава',
  '{0} days ago': 'преди {0} дни',
  '{0} deals': 'Раздава {0}',
  '{0} died on a dangerous adventure.': '{0} загина в опасно приключение.',
  '{0} fell in battle. Revive them in the Hall of Heroes.': '{0} падна в битка. Съживете го в Залата на героите.',
  '{0} fighters joined the hero.': 'Към героя се присъединиха {0} бойци.',
  '{0} found an item: {1}.': '{0} намери предмет: {1}.',
  '{0} found hidden supplies.': '{0} намери скрити запаси.',
  '{0} gathered souls from an ancient battlefield.': '{0} събра души от древно бойно поле.',
  '{0} gives': '{0} дава',
  '{0} got their pieces home first.': '{0} изкара пуловете си първи.',
  '{0} h ago': 'преди {0} ч',
  '{0} h {1} min': '{0} ч {1} мин',
  '{0} has been replaced by a bot.': '{0} е заменен от бот.',
  '{0} has no': '{0} няма',
  '{0} has returned to life.': '{0} се върна към живота.',
  '{0} have passed. The empire never sleeps.': 'Минаха {0}. Империята не спи.',
  '{0} helped travellers and received gold.': '{0} помогна на пътници и получи злато.',
  '{0} invites you to play {1} online.': '{0} ви кани да играете {1} онлайн.',
  '{0} is nothing but ashes and a Citadel. Build a {1}, a sawmill and a quarry, train troops and crush the barbarians around you.': '{0} е само пепелище и една Цитадела. Изградете {1}, дъскорезница и кариера, обучете войска и разбийте варварите наоколо.',
  '{0} is rolling…': '{0} хвърля…',
  '{0} joined the alliance.': '{0} се присъедини към съюза.',
  '{0} left the alliance.': '{0} напусна съюза.',
  '{0} looking': '{0} търсят',
  '{0} min': '{0} мин',
  '{0} min ago': 'преди {0} мин',
  '{0} more': 'още {0}',
  '{0} moves with {1}.': '{0} ход с {1}.',
  '{0} offers a draw. Do you accept?': '{0} предлага реми. Приемате ли?',
  '{0} play everything – {1} × {2} passes to {3}.': '{0} да изиграе всичко – {1} × {2} минава у {3}.',
  '{0} players · {1} · winner {2}': '{0} играчи · {1} · победител {2}',
  '{0} plundered {1}!': '{0} ограби {1}!',
  '{0} reached level {1}!': '{0} достигна ниво {1}!',
  '{0} reached level {1}{2}.': '{0} достигна ниво {1}{2}.',
  '{0} reached {1} first.': '{0} стигна {1} първи.',
  '{0} repelled the attack of {1}.': '{0} отби нападението на {1}.',
  '{0} resigned the game{1}.': '{0} предаде играта{1}.',
  '{0} resigned.': '{0} се предаде.',
  '{0} returned from an adventure.': '{0} се върна от приключение.',
  '{0} rolled': '{0} хвърли',
  '{0} rolled a six and rolls': '{0} хвърли шестица и хвърля',
  '{0} rolled {1}.': '{0} хвърли {1}.',
  '{0} rounds{1}': '{0} рунда{1}',
  '{0} s': '{0} сек',
  '{0} sets out alone. Health: {1}%.': '{0} тръгва сам. Живот: {1}%.',
  '{0} solved the solitaire first.': '{0} нареди пасианса пръв.',
  '{0} starts': 'започва {0}',
  '{0} takes': '{0} взема',
  '{0} the swamp': '{0} блатото',
  '{0} tiles/h': '{0} пол./ч',
  '{0} to move…': '{0} е на ход…',
  '{0} wants to be friends.': '{0} иска да сте приятели.',
  '{0} was kicked.': '{0} беше изключен.',
  '{0} will not be enough for them – upgrade the farm.': '{0} няма да стигне за тях – подобрете фермата.',
  '{0} wins the deal': '{0} печели раздаването',
  '{0} wins the game{1} – +{2}': '{0} печели играта{1} – +{2}',
  '{0} wins · {1} games · {2}': '{0} победи · {1} игри · {2}',
  '{0} wins.': '{0} печели.',
  '{0} won the match.': '{0} спечели мача.',
  '{0} {1} in the lobby': '{0} {1} в лобито',
  '{0} {1} {2} to {3}': '{0} {1} {2} на {3}',
  '{0} {1} – no possible move.': '{0} {1} – няма възможен ход.',
  '{0} · computer': '{0} · компютър',
  '{0} · to +{1}': '{0} · до +{1}',
  '{0} · until {1}': '{0} · до {1}',
  '{0} · {1} pts': '{0} · {1} т.',
  '{0} · {1} · {2} moves': '{0} · {1} · {2} хода',
  '{0} · {1} · {2} points · {3} city(ies)': '{0} · {1} · {2} точки · {3} град(а)',
  '{0}%/h': '{0}%/ч',
  '{0}\'s room': 'Стая на {0}',
  '{0}/h': '{0}/ч',
  '{0}: +{1}/h': '{0}: +{1}/ч',
  '{0}: oasis ({1}|{2}){3}': '{0}: оазис ({1}|{2}){3}',
  '{0}: {1} (level {2}){3}': '{0}: {1} (ниво {2}){3}',
  '{0}:{1} · to {2}': '{0}:{1} · до {2}',
  '{0}:{1} · to {2} · {3}': '{0}:{1} · до {2} · {3}',
  '{0}d {1}h': '{0}д {1}ч',
  '{0}h {1}m': '{0}ч {1}м',
  '{0}m {1}s': '{0}м {1}с',
  '{0}s': '{0}с',
  '{0}{1}/h': '{0}{1}/ч',
  '~{0} soldiers (types – from tower level 3, exact makeup – from level 5)': '~{0} войници (видове – от кула ниво 3, точен състав – от ниво 5)',
  '½ Draw?': '½ Реми?',
  '← Conversations': '← Разговори',
  '↩ {0} from {1}': '↩ {0} от {1}',
  '⌂ My city': '⌂ Моят град',
  '⏱ Travel: ': '⏱ Път: ',
  '⚔ Attack': '⚔ Атака',
  '⚔ Battle at {0}…': '⚔ Битка при {0}…',
  '⚔ Battle formation': '⚔ Бойна формация',
  '⚔ Lead the battle: {0}': '⚔ Поведете битката: {0}',
  '⚔ {0} · {1} in training': '⚔ {0} · {1} в обучение',
  '⚔ {0} · 🛡 {1} · ❤ {2} · move {3} · range {4}': '⚔ {0} · 🛡 {1} · ❤ {2} · ход {3} · обсег {4}',
  '⚠ Dangerous adventure': '⚠ Опасно приключение',
  '⚠ The attack will end your beginner protection.': '⚠ Атаката ще прекрати защитата ви за новаци.',
  '⚠ {0} attacks {1} in {2} min!': '⚠ {0} напада {1} след {2} мин!',
  '⚠ {0} attacks {1} in {2}!': '⚠ {0} напада {1} след {2}!',
  '✔ claimed': '✔ взета',
  '🌙 Arrives at night – the defenders get +{0}% defense.': '🌙 Пристига през нощта – защитниците получават +{0}% защита.',
  '🌙 Night bonus for the defenders': '🌙 Нощен бонус за защитниците',
  '🌴 The oasis is conquered!': '🌴 Оазисът е завладян!',
  '🎨 Style': '🎨 Вид',
  '🎵 Music': '🎵 Музика',
  '🏰 Found a city': '🏰 Основи град',
  '🏰 Settling': '🏰 Заселване',
  '🐦 City': '🐦 Град',
  '👁 Scout': '👁 Разузнай',
  '👁 Scouting': '👁 Разузнаване',
  '👑 City loyalty: {0}%': '👑 Лоялност на града: {0}%',
  '💀 {0} fallen enemies rose as skeletons': '💀 {0} паднали врагове се вдигнаха като скелети',
  '🔇 Off': '🔇 Изключен',
  '🔇 Sound': '🔇 Звук',
  '🔊 On': '🔊 Включен',
  '🔊 Sound': '🔊 Звук',
  '🔒 Close': '🔒 Затвори',
  '🔨 The builders are resting': '🔨 Строителите почиват',
  '🚩 Raid': '🚩 Набег',
  '🛡 Beginner protection: {0} more. It ends earlier if you attack another ruler.': '🛡 Защита за новаци: още {0}. Изтича по-рано, ако нападнете друг владетел.',
  '🛡 Reinforce': '🛡 Подкрепи',
  '🛡 Reinforcement': '🛡 Подкрепа',
  '🛡 Send troops': '🛡 Изпрати войска',
  '🛡 Under beginner protection for {0} more.': '🛡 Под защита за новаци още {0}.',
  '🧭 Adventure': '🧭 Приключение',
  '🧭 Send the hero': '🧭 Изпрати героя',
  '🪨 Damaged buildings: {0}': '🪨 Повредени сгради: {0}',
  '🪨 The catapults knocked down {0} levels of the wall': '🪨 Катапултите събориха {0} нива от стената',
};

return { BG };
})();

__m['js/games/empires/data.js'] = (() => {
// Evil Empires – data: races, resources, epochs, buildings, units, technologies, hero,
// world (oases, computer empires), missions. All balance numbers live here.
const { tk } = __m['js/i18n/tk.js'];

const RES = ['gold', 'wood', 'stone', 'food', 'mana', 'souls'];
const RES_NAMES = { gold: tk('Gold'), wood: tk('Wood'), stone: tk('Stone'), food: tk('Food'), mana: tk('Mana'), souls: tk('Souls') };
const resName = (race, r) => (r === 'food' && race === 'undead' ? tk('Bones') : RES_NAMES[r]);

const RACES = {
  humans: {
    name: tk('Humans'),
    lore: tk('The surviving kingdoms after the Fall – stubborn builders and traders.'),
    perks: [tk('+10% to all resources'), tk('Construction is 10% faster')],
    weak: tk('Average units'),
    color: '#e8b04a',
  },
  undead: {
    name: tk('Undead'),
    lore: tk('A necromancer\'s army, raised from the graves of the old empire.'),
    perks: [tk('The army does not eat'), tk('Units are 20% cheaper'), tk('After a victory some of the fallen rise as skeletons')],
    weak: tk('Slow growth (−15% population)'),
    color: '#5fe39a',
  },
  orcs: {
    name: tk('Orcs'),
    lore: tk('Clans from the ashlands who live off plunder.'),
    perks: [tk('+20% attack for infantry and spearmen'), tk('+25% loot from raids'), tk('Enemy hideouts protect 20% less')],
    weak: tk('Research is 20% slower'),
    color: '#ff5a3c',
  },
  vesheri: {
    name: tk('Witchers'),
    lore: tk('A people of mages and monster hunters, trained in secret towers.'),
    perks: [tk('+20% attack for archers'), tk('+25% mana'), tk('Their scouts cannot be detected')],
    weak: tk('Units are 20% more expensive'),
    color: '#b48cff',
  },
};

const EPOCHS = [
  { n: 1, name: tk('Ash Age'), cap: 5 },
  { n: 2, name: tk('Bronze Age'), cap: 10 },
  { n: 3, name: tk('Iron Age'), cap: 15 },
  { n: 4, name: tk('Age of Kingdoms'), cap: 20 },
  { n: 5, name: tk('Age of Darkness'), cap: 25 },
];
// The last epoch reachable in this version of the game.
const MAX_EPOCH = 3;

const EPOCH_UP = {
  2: {
    hall: 5, tech: 'bronze', story: 's17',
    cost: { wood: 2500, stone: 2500, gold: 1500, food: 2000 },
    time: 1800,
  },
  3: {
    hall: 10, tech: 'iron', story: 'k3',
    cost: { wood: 12000, stone: 12000, gold: 8000, food: 10000, mana: 2000 },
    time: 7200,
  },
};

// Buildings. cost/time are for level 1 and grow with every level (COST_GROWTH, TIME_GROWTH).
// prod: production per hour at level 1. need: requirement for another building.
const COST_GROWTH = 1.55;
const TIME_GROWTH = 1.75;

const BUILDINGS = {
  hall: {
    name: tk('Citadel'), epoch: 1,
    desc: tk('The heart of the city. Its level limits the other buildings, speeds up construction and allows new cities.'),
    cost: { wood: 150, stone: 120, gold: 60 }, time: 90,
  },
  farm: {
    name: tk('Farm'), undeadName: tk('Graveyard'), epoch: 1,
    desc: tk('Produces food for the population and the army.'), undeadDesc: tk('Digs up bones – the main resource of the undead.'),
    cost: { wood: 60, stone: 30 }, time: 40, prod: { food: 70 },
  },
  lumber: { name: tk('Sawmill'), epoch: 1, desc: tk('Cuts and processes wood.'), cost: { wood: 30, stone: 40, food: 20 }, time: 40, prod: { wood: 80 } },
  quarry: { name: tk('Quarry'), epoch: 1, desc: tk('Mines stone for walls and buildings.'), cost: { wood: 60, food: 20 }, time: 45, prod: { stone: 65 } },
  mine: { name: tk('Gold Mine'), epoch: 1, desc: tk('Mines gold.'), cost: { wood: 80, stone: 60 }, time: 60, prod: { gold: 45 } },
  houses: { name: tk('Houses'), epoch: 1, desc: tk('Increase the population (room for troops) and bring taxes.'), cost: { wood: 70, stone: 40, food: 30 }, time: 50, prod: { gold: 12 } },
  warehouse: { name: tk('Warehouse'), epoch: 1, desc: tk('Increases how many resources you can store.'), cost: { wood: 80, stone: 70 }, time: 55 },
  barracks: { name: tk('Barracks'), epoch: 1, desc: tk('Trains troops. Each level speeds up training by 4%.'), cost: { wood: 120, stone: 80, gold: 40 }, time: 70 },
  academy: { name: tk('Academy'), epoch: 1, desc: tk('Researches technologies. Each level speeds up research by 5%.'), cost: { wood: 100, stone: 120, gold: 80 }, time: 80 },
  heroHall: {
    name: tk('Hall of Heroes'), epoch: 1,
    desc: tk('Home of the hero: revives them and allows conquering oases (levels 3, 6 and 10 – one oasis each).'),
    cost: { wood: 160, stone: 140, gold: 100 }, time: 90,
  },
  wall: {
    name: tk('Palisade'), name2: tk('City Wall'), epoch: 1,
    desc: tk('Defenders get +6% defense and +3% health per level.'),
    cost: { wood: 120, stone: 90 }, time: 60,
  },
  traps: {
    name: tk('Traps'), epoch: 1, need: { wall: 1 },
    desc: tk('Catch some of the attackers before they reach the walls.'),
    cost: { wood: 90, stone: 40, gold: 30 }, time: 55,
  },
  cranny: {
    name: tk('Hideout'), epoch: 1,
    desc: tk('Protects part of every resource from plunder.'),
    cost: { wood: 50, stone: 70 }, time: 35,
  },
  embassy: {
    name: tk('Embassy'), epoch: 1,
    desc: tk('Alliance membership (level 1) and founding an alliance (level 3). Each level gives 3 alliance slots.'),
    cost: { wood: 150, stone: 130, gold: 100 }, time: 90,
  },
  tower: {
    name: tk('Watchtower'), epoch: 1, need: { wall: 1 },
    desc: tk('Sees approaching attacks from farther away and reveals their makeup. The tower\'s archers give +2% defense per level.'),
    cost: { wood: 100, stone: 120, gold: 40 }, time: 70,
  },
  temple: {
    name: tk('Temple'), epoch: 3,
    desc: tk('Gathers souls and speeds up the hero\'s recovery (+3% per hour per level if the hero is in this city).'),
    cost: { wood: 800, stone: 1500, gold: 1200 }, time: 900, prod: { souls: 0.6 },
  },
  stable: {
    name: tk('Stables'), epoch: 3,
    desc: tk('Trains heavy cavalry. Each level speeds up cavalry training by 5%.'),
    cost: { wood: 1400, stone: 1100, gold: 900 }, time: 900,
  },
  altar: { name: tk('Altar'), epoch: 2, tech: 'mysticism', desc: tk('Gathers mana from the rifts of the Fall.'), cost: { stone: 400, gold: 300 }, time: 300, prod: { mana: 30 } },
  smithy: { name: tk('Smithy'), epoch: 2, desc: tk('Each level gives +3% attack and defense to the city\'s troops.'), cost: { wood: 350, stone: 300, gold: 200 }, time: 300 },
  unique: { name: '', epoch: 2, desc: '', cost: { wood: 500, stone: 500, gold: 400 }, time: 420 },
};

const UNIQUE = {
  humans: { name: tk('Merchant Guild'), desc: tk('Brings gold and trains paladins.'), prod: { gold: 60 } },
  undead: { name: tk('Necropolis'), desc: tk('Digs up more bones and raises ghouls.'), prod: { food: 70 } },
  orcs: { name: tk('Fighting Pit'), desc: tk('Trains berserkers. Each level speeds up troop training by 5%.') },
  vesheri: { name: tk('Witchers\' Tower'), desc: tk('Gathers mana and trains witchers.'), prod: { mana: 40 } },
};

// Building layout in the city: (i, j) on a 5×5 isometric grid (tall buildings at the back).
// The palisade and traps have no plot – they are drawn along the city edge.
const GRID = 5;
const PLOTS = {
  hall: [0, 0], unique: [1, 0], academy: [0, 1], temple: [2, 0], barracks: [1, 1], smithy: [0, 2],
  mine: [3, 0], heroHall: [2, 1], houses: [1, 2], lumber: [0, 3], quarry: [4, 0], warehouse: [3, 1],
  embassy: [2, 2], farm: [1, 3], stable: [0, 4], altar: [4, 1], cranny: [2, 3], tower: [1, 4],
};
const DECOR = [[3, 2, 'well'], [4, 2, 'trees'], [3, 3, 'campfire'], [2, 4, 'trees'], [4, 3, 'trees'], [3, 4, 'trees'], [4, 4, 'trees']];
const OFF_PLOT = ['wall', 'traps'];

// Units. cls: inf, spear, ranged, cav; scout and settler do not fight.
// speed: tiles per hour (multiplied by WORLD_SPEED).
const UNITS = {
  warrior: { cls: 'inf', epoch: 1, hp: 10, atk: 3, def: 1, carry: 15, upkeep: 1, speed: 7, cost: { food: 40, gold: 15, wood: 10 }, time: 45 },
  slinger: { cls: 'ranged', epoch: 1, tech: 'slings', hp: 6, atk: 4, def: 0, carry: 10, upkeep: 1, speed: 7, cost: { food: 35, wood: 30, gold: 15 }, time: 55 },
  catapult: { cls: 'siege', epoch: 2, tech: 'engineering', barracks: 5, hp: 30, atk: 2, def: 1, carry: 0, upkeep: 3, speed: 3, cost: { wood: 320, stone: 220, gold: 160 }, time: 300 },
  noble: { cls: 'noble', epoch: 2, tech: 'nobility', hall: 10, hp: 20, atk: 1, def: 2, carry: 0, upkeep: 4, speed: 4, cost: { gold: 4000, food: 3000, wood: 2500, stone: 2500, souls: 50 }, time: 3600 },
  scout: { cls: 'scout', epoch: 1, tech: 'scouting', hp: 2, atk: 0, def: 1, carry: 0, upkeep: 1, speed: 18, cost: { food: 30, gold: 40, wood: 20 }, time: 40 },
  settler: { cls: 'settler', epoch: 1, hall: 5, hp: 5, atk: 0, def: 0, carry: 0, upkeep: 2, speed: 5, cost: { food: 1500, wood: 1300, stone: 1300, gold: 900 }, time: 2400 },
  spear: { cls: 'spear', epoch: 2, tech: 'spears', hp: 12, atk: 3, def: 3, carry: 15, upkeep: 1, speed: 6, cost: { food: 50, wood: 40, gold: 25 }, time: 70 },
  archer: { cls: 'ranged', epoch: 2, tech: 'archery', hp: 8, atk: 6, def: 1, carry: 10, upkeep: 1, speed: 7, cost: { food: 45, wood: 60, gold: 30 }, time: 80 },
  rider: { cls: 'cav', epoch: 2, tech: 'riding', barracks: 3, hp: 18, atk: 6, def: 2, carry: 35, upkeep: 2, speed: 16, cost: { food: 90, gold: 70, wood: 30 }, time: 120 },
  pike: { cls: 'spear', epoch: 3, tech: 'pikes', hp: 16, atk: 5, def: 7, carry: 20, upkeep: 1, speed: 6, cost: { food: 80, wood: 70, gold: 50, stone: 20 }, time: 110 },
  crossbow: { cls: 'ranged', epoch: 3, tech: 'crossbows', hp: 11, atk: 10, def: 2, carry: 12, upkeep: 1, speed: 6, cost: { food: 70, wood: 90, gold: 60 }, time: 130 },
  knight: { cls: 'cav', epoch: 3, tech: 'chivalry', stable: 1, hp: 34, atk: 12, def: 6, carry: 45, upkeep: 3, speed: 14, cost: { food: 160, gold: 150, wood: 40, stone: 40 }, time: 220 },
  elite: { cls: 'inf', epoch: 2, unique: 1, hp: 30, atk: 9, def: 5, carry: 20, upkeep: 2, speed: 5, cost: { food: 120, gold: 120, mana: 30 }, time: 180 },
};
const UNIT_ORDER = ['warrior', 'slinger', 'spear', 'archer', 'rider', 'elite', 'pike', 'crossbow', 'knight', 'catapult', 'noble', 'scout', 'settler'];
const FIGHTERS = ['warrior', 'slinger', 'spear', 'archer', 'rider', 'elite', 'pike', 'crossbow', 'knight', 'catapult', 'noble'];

const UNIT_NAMES = {
  humans: { warrior: tk('Militiaman'), slinger: tk('Slinger'), spear: tk('Spearman'), archer: tk('Archer'), rider: tk('Horseman'), elite: tk('Paladin'), pike: tk('Pikeman'), crossbow: tk('Crossbowman'), knight: tk('Knight'), catapult: tk('Catapult'), noble: tk('Nobleman'), scout: tk('Scout'), settler: tk('Settlers') },
  undead: { warrior: tk('Skeleton'), slinger: tk('Bone Slinger'), spear: tk('Grave Spearman'), archer: tk('Ghost Archer'), rider: tk('Dead Rider'), elite: tk('Ghoul'), pike: tk('Bone Pikeman'), crossbow: tk('Cursed Archer'), knight: tk('Death Knight'), catapult: tk('Bonecrusher'), noble: tk('Lich'), scout: tk('Wraith'), settler: tk('Gravediggers') },
  orcs: { warrior: tk('Brute'), slinger: tk('Thrower'), spear: tk('Spearman'), archer: tk('Hunter'), rider: tk('Wolf Rider'), elite: tk('Berserker'), pike: tk('Spiker'), crossbow: tk('Javelineer'), knight: tk('Boar Rider'), catapult: tk('Battering Ram'), noble: tk('Warlord'), scout: tk('Tracker'), settler: tk('Settlers') },
  vesheri: { warrior: tk('Novice'), slinger: tk('Slinger'), spear: tk('Guard'), archer: tk('Crossbowman'), rider: tk('Night Rider'), elite: tk('Witcher'), pike: tk('Warden'), crossbow: tk('Demon Hunter'), knight: tk('Silver Knight'), catapult: tk('Trebuchet'), noble: tk('Magister'), scout: tk('Shadow'), settler: tk('Settlers') },
};
const unitCls = (race, u) => (u === 'elite' && race === 'vesheri' ? 'ranged' : UNITS[u].cls);

const CLS_NAMES = { inf: tk('infantry'), spear: tk('spears'), ranged: tk('archers'), cav: tk('cavalry'), siege: tk('siege'), noble: tk('conquest'), scout: tk('scouting'), settler: tk('settling'), hero: tk('hero') };
const COUNTER = {
  spear: { cav: 2 },
  cav: { ranged: 2, inf: 1.2 },
  ranged: { spear: 1.5, inf: 1.2 },
  inf: { ranged: 1.2 },
};

// World speed: how many times faster than the "classic" browser strategies.
const WORLD_SPEED = 3;

const TECHS = {
  agri: { name: tk('Agriculture'), epoch: 1, academy: 1, desc: tk('+15% food'), cost: { gold: 120, wood: 100 }, time: 120 },
  carp: { name: tk('Carpentry'), epoch: 1, academy: 1, desc: tk('+15% wood'), cost: { gold: 120, stone: 100 }, time: 120 },
  scouting: { name: tk('Scouting'), epoch: 1, academy: 1, desc: tk('Unlocks scouts'), cost: { gold: 120, food: 120 }, time: 150 },
  mason: { name: tk('Masonry'), epoch: 1, academy: 2, desc: tk('+15% stone'), cost: { gold: 150, wood: 150 }, time: 180 },
  slings: { name: tk('Slings'), epoch: 1, academy: 1, desc: tk('Unlocks slingers'), cost: { gold: 100, wood: 120 }, time: 150 },
  tactics: { name: tk('Formation'), epoch: 1, academy: 2, req: ['slings'], desc: tk('+10% infantry attack'), cost: { gold: 200, food: 200 }, time: 240 },
  bronze: { name: tk('Bronze Casting'), epoch: 1, academy: 3, req: ['agri', 'mason'], desc: tk('Required for the Bronze Age'), cost: { gold: 600, stone: 500, wood: 400 }, time: 900 },
  spears: { name: tk('Spears'), epoch: 2, academy: 4, desc: tk('Unlocks spearmen (strong against cavalry)'), cost: { gold: 500, wood: 600 }, time: 900 },
  archery: { name: tk('Bows'), epoch: 2, academy: 4, req: ['slings'], desc: tk('Unlocks bow archers'), cost: { gold: 600, wood: 700 }, time: 1100 },
  riding: { name: tk('Horse Riding'), epoch: 2, academy: 5, desc: tk('Unlocks cavalry (requires Barracks level 3)'), cost: { gold: 900, food: 900 }, time: 1500 },
  mysticism: { name: tk('Mysticism'), epoch: 2, academy: 5, desc: tk('Unlocks the Altar and mana'), cost: { gold: 1000, stone: 800 }, time: 1800 },
  smith: { name: tk('Smithing'), epoch: 2, academy: 6, req: ['spears'], desc: tk('+10% army attack'), cost: { gold: 1400, stone: 1200 }, time: 2700 },
  armor: { name: tk('Armor'), epoch: 2, academy: 6, req: ['smith'], desc: tk('+10% army defense'), cost: { gold: 1600, stone: 1400 }, time: 3200 },
  trade: { name: tk('Trade'), epoch: 2, academy: 5, desc: tk('+15% gold'), cost: { gold: 800, wood: 800 }, time: 1600 },
  engineering: { name: tk('Engineering'), epoch: 2, academy: 6, req: ['mason'], desc: tk('Unlocks catapults – they destroy walls and buildings (requires Barracks level 5)'), cost: { gold: 1800, wood: 2200, stone: 1800 }, time: 3600 },
  nobility: { name: tk('Nobility'), epoch: 2, academy: 8, req: ['trade'], desc: tk('Unlocks noblemen – they lower loyalty and conquer cities (Citadel 10)'), cost: { gold: 6000, food: 4000, souls: 30 }, time: 7200 },
  logistics: { name: tk('Logistics'), epoch: 2, academy: 7, req: ['trade'], desc: tk('A second construction queue'), cost: { gold: 2500, wood: 2000, stone: 2000 }, time: 4800 },
  iron: { name: tk('Iron'), epoch: 2, academy: 10, req: ['smith', 'armor'], desc: tk('Required for the Iron Age'), cost: { gold: 8000, stone: 8000, mana: 1500 }, time: 14400 },
  crop: { name: tk('Crop Rotation'), epoch: 3, academy: 10, desc: tk('+15% food'), cost: { gold: 3000, wood: 3000 }, time: 5400 },
  pikes: { name: tk('Pikes'), epoch: 3, academy: 10, req: ['spears'], desc: tk('Unlocks pikemen'), cost: { gold: 3500, wood: 4000 }, time: 6000 },
  fortify: { name: tk('Fortifications'), epoch: 3, academy: 11, desc: tk('+50% to the wall bonus'), cost: { gold: 4000, stone: 6000 }, time: 7200 },
  crossbows: { name: tk('Crossbows'), epoch: 3, academy: 11, req: ['archery'], desc: tk('Unlocks crossbowmen'), cost: { gold: 4500, wood: 5000 }, time: 7800 },
  chivalry: { name: tk('Chivalry'), epoch: 3, academy: 12, req: ['riding'], desc: tk('Unlocks heavy cavalry (requires Stables)'), cost: { gold: 6000, food: 6000 }, time: 9000 },
  steel: { name: tk('Steel'), epoch: 3, academy: 12, req: ['iron'], desc: tk('+10% army attack'), cost: { gold: 7000, stone: 7000 }, time: 10800 },
  banking: { name: tk('Banking'), epoch: 3, academy: 12, req: ['trade'], desc: tk('+15% gold'), cost: { gold: 6000, wood: 5000 }, time: 9000 },
  plate: { name: tk('Plate Armor'), epoch: 3, academy: 13, req: ['steel'], desc: tk('+10% army defense'), cost: { gold: 8000, stone: 9000 }, time: 12600 },
  kingdoms: { name: tk('Feudal Law'), epoch: 3, academy: 15, req: ['steel', 'plate'], desc: tk('Required for the Age of Kingdoms (coming soon)'), cost: { gold: 20000, stone: 20000, mana: 5000 }, time: 28800 },
};
const TECH_PROD = { agri: 'food', carp: 'wood', mason: 'stone', trade: 'gold', crop: 'food', banking: 'gold' };

// ---------- tactical battles ----------
const TACTIC = { cols: 9, rows: 7, maxTurns: 12, window: 3600 };
const TERRAIN = {
  plain: { name: tk('Plain'), cost: 1, def: 1 },
  forest: { name: tk('Forest'), cost: 2, def: 1.25, vsRanged: true },
  hill: { name: tk('Hill'), cost: 2, def: 1.2, range: 1 },
  ruins: { name: tk('Ruins'), cost: 1, def: 1.35 },
  water: { name: tk('River'), cost: 99, def: 1 },
};
const MOVES = { inf: 2, spear: 2, ranged: 2, cav: 4, hero: 3, siege: 1, noble: 2 };
// Default battle formation: where each class stands in a tactical battle.
const FORMATION = { inf: 'front', spear: 'front', hero: 'front', ranged: 'back', cav: 'flank', siege: 'back', noble: 'back' };
const LOYALTY_REGEN = 2; // % per hour

// ---------- hero ----------
const HERO = {
  pointsPerLevel: 4, startPoints: 5,
  regen: 10, // % health per hour
  speed: 9, // tiles per hour
  xpFor: (lvl) => Math.round(60 * lvl ** 1.7),
};
const HERO_POINTS = {
  str: { name: tk('Strength'), desc: tk('+4 hero attack in battle') },
  off: { name: tk('Offense'), desc: tk('+0.2% attack for the army the hero travels with') },
  def: { name: tk('Defense'), desc: tk('+0.2% defense for the army in the hero\'s city') },
  res: { name: tk('Steward'), desc: tk('+1% production in the hero\'s city (up to 25%)') },
};
const SLOTS = { weapon: tk('Weapon'), armor: tk('Armor'), helmet: tk('Helmet'), horse: tk('Horse'), amulet: tk('Amulet') };
const TIERS = [
  { name: tk('common'), color: '#b9b4a8' },
  { name: tk('rare'), color: '#6aa8ff' },
  { name: tk('epic'), color: '#b48cff' },
  { name: tk('legendary'), color: '#f2c14e' },
];
// Item effect by slot and level (1–4).
const ITEM_FX = {
  weapon: { val: [6, 12, 20, 32], text: (v) => tk('+{0} hero attack', v) },
  armor: { val: [30, 60, 110, 180], text: (v) => tk('+{0} hero health, −{1}% wounds', v, Math.round(v / 7)) },
  helmet: { val: [10, 20, 35, 50], text: (v) => tk('+{0}% experience', v) },
  horse: { val: [30, 60, 90, 130], text: (v) => tk('+{0}% hero speed', v) },
  amulet: { val: [5, 10, 15, 25], text: (v) => tk('+{0}% recovery per hour', v) },
};
const ITEM_NAMES = {
  weapon: [tk('Rusty Sword'), tk('Bronze Sword'), tk('Warlord\'s Sword'), tk('Blade of the Fall')],
  armor: [tk('Leather Armor'), tk('Chain Mail'), tk('Bronze Armor'), tk('Dragon Scales')],
  helmet: [tk('Leather Cap'), tk('Bronze Helmet'), tk('Crested Helmet'), tk('Crown of the Ancestors')],
  horse: [tk('Old Nag'), tk('Steppe Horse'), tk('War Stallion'), tk('Night Steed')],
  amulet: [tk('Bone Amulet'), tk('Silver Talisman'), tk('Witcher\'s Eye'), tk('Heart of the Fall')],
};
const ADVENTURE = { every: 5 * 3600, max: 4, life: 24 * 3600 };

// ---------- world ----------
const WORLD_R = 20; // coordinates from −20 to 20
const OASIS_RES = ['wood', 'stone', 'food', 'gold'];
const OASIS_BONUS = 0.25;
const OASIS_RANGE = 3;
const OASIS_RESPAWN = 8 * 3600;
const CAMP_RESPAWN = 1200;
const CAMP_SLOTS = [1, 2, 2, 3, 4, 5];
const CAMP_START = [1, 1, 2, 2, 3, 4];
const CAMP_NAMES = [tk('Marauders'), tk('Ash Bandits'), tk('Wolf Pack'), tk('Lair'), tk('Bandit Fort'), tk('Warlord\'s Camp')];

const PROTECTION = 5 * 24 * 3600; // beginner protection (seconds at speed 1)
const NIGHT = { from: 0, to: 7, bonus: 1.5 }; // night bonus to defense
const NPC_ATTACK_EVERY = [10 * 3600, 22 * 3600];
const PACT = { time: 3 * 24 * 3600 };

const NPC_CLANS = [
  { id: 'c0', name: tk('The Ashen'), tag: tk('ASH'), color: '#a8553a' },
  { id: 'c1', name: tk('The Night Wolves'), tag: tk('WLF'), color: '#5a6a9a' },
  { id: 'c2', name: tk('The Blood Crescent'), tag: tk('BLD'), color: '#9a2a3a' },
];
const NPC_NAMES = [
  tk('Vorg the Ashen'), tk('Sisters of the Mist'), tk('Khan Zlorud'), tk('Black Boyan'), tk('Velmira the Dark'), tk('Rotten Darg'), tk('The Wolf Khan'),
  tk('Silent Stoyan'), tk('Goran the Bonecrusher'), tk('Morana the Witch'), tk('Iron Ratko'), tk('The Ash Viper'), tk('Grey Dragosh'), tk('The Nameless'),
];

// ---------- missions ----------
const lvl = (b) => (s) => Math.max(0, ...s.cities.map((c) => c.b[b] || 0));
const STORY = [
  { id: 's1', title: tk('Hearth'), text: tk('Build a farm'), undeadText: tk('Build a graveyard'), goal: 1, get: lvl('farm'), reward: { wood: 150, stone: 100 } },
  { id: 's2', title: tk('Wood for the Winter'), text: tk('Build a sawmill'), goal: 1, get: lvl('lumber'), reward: { food: 150, gold: 50 } },
  { id: 's3', title: tk('Stone by Stone'), text: tk('Build a quarry'), goal: 1, get: lvl('quarry'), reward: { wood: 200 } },
  { id: 'h1', title: tk('The Hero\'s Path'), text: tk('Send the hero on an adventure'), goal: 1, get: (s) => s.stats.adventures || 0, reward: { gold: 150, food: 150 } },
  { id: 's4', title: tk('A Roof Overhead'), text: tk('Build houses'), goal: 1, get: lvl('houses'), reward: { gold: 120 } },
  { id: 's5', title: tk('The Citadel Grows'), text: tk('Citadel level 2'), goal: 2, get: lvl('hall'), reward: { wood: 250, stone: 250 } },
  { id: 's6', title: tk('Under the Banners'), text: tk('Build barracks'), goal: 1, get: lvl('barracks'), reward: { food: 300 } },
  { id: 's7', title: tk('The First Warriors'), text: tk('Train 5 units'), goal: 5, get: (s) => s.stats.trained, reward: { gold: 200, food: 200 } },
  { id: 's8', title: tk('Blood on the Ashes'), text: tk('Defeat a level 1 camp'), goal: 1, get: (s) => (s.stats.bestCamp >= 1 ? 1 : 0), reward: { gold: 250, wood: 250, souls: 2 } },
  { id: 'd1', title: tk('Behind Stake and Stone'), text: tk('Build a palisade'), goal: 1, get: lvl('wall'), reward: { wood: 250, stone: 150 } },
  { id: 's9', title: tk('Knowledge Is Power'), text: tk('Build an academy'), goal: 1, get: lvl('academy'), reward: { gold: 200 } },
  { id: 's10', title: tk('The First Science'), text: tk('Complete one research'), goal: 1, get: (s) => Object.keys(s.techs).length, reward: { wood: 300, stone: 300 } },
  { id: 'd2', title: tk('Hidden Treasure'), text: tk('Build a hideout'), goal: 1, get: lvl('cranny'), reward: { gold: 200 } },
  { id: 's11', title: tk('Supplies'), text: tk('Warehouse level 2'), goal: 2, get: lvl('warehouse'), reward: { food: 400 } },
  { id: 'h2', title: tk('A Home for the Hero'), text: tk('Build the Hall of Heroes'), goal: 1, get: lvl('heroHall'), reward: { gold: 300, wood: 300 } },
  { id: 's12', title: tk('Stone Walls'), text: tk('Citadel level 3'), goal: 3, get: lvl('hall'), reward: { gold: 400, stone: 400 } },
  { id: 'd3', title: tk('Eyes in the Dark'), text: tk('Scout a foreign city'), goal: 1, get: (s) => s.stats.scouted || 0, reward: { gold: 300, food: 300 } },
  { id: 's13', title: tk('Economy'), text: tk('Farm, sawmill, quarry and mine at level 3'), goal: 4, get: (s) => ['farm', 'lumber', 'quarry', 'mine'].filter((b) => lvl(b)(s) >= 3).length, reward: { gold: 500, food: 500 } },
  { id: 's14', title: tk('The Voice of War'), text: tk('Defeat a level 3 camp'), goal: 1, get: (s) => (s.stats.bestCamp >= 3 ? 1 : 0), reward: { gold: 500, wood: 500, souls: 5 } },
  { id: 'd4', title: tk('We Held!'), text: tk('Repel an attack'), goal: 1, get: (s) => s.stats.defWins || 0, reward: { gold: 600, stone: 600, souls: 5 } },
  { id: 's15', title: tk('The Secret of Bronze'), text: tk('Research Bronze Casting'), goal: 1, get: (s) => (s.techs.bronze ? 1 : 0), reward: { stone: 800, wood: 800 } },
  { id: 'h3', title: tk('The Spring'), text: tk('Conquer an oasis'), goal: 1, get: (s) => s.oases.length, reward: { gold: 800, souls: 8 } },
  { id: 's16', title: tk('Stronghold'), text: tk('Citadel level 5'), goal: 5, get: lvl('hall'), reward: { gold: 800 } },
  { id: 's17', title: tk('Warlord of the Ashlands'), text: tk('Defeat a level 5 camp – the barbarian warlord'), goal: 1, get: (s) => (s.stats.bestCamp >= 5 ? 1 : 0), reward: { gold: 1000, food: 1000, souls: 10 }, key: true },
  { id: 's18', title: tk('A New Age'), text: tk('Enter the Bronze Age'), goal: 2, get: (s) => s.epoch, reward: { gold: 1500, wood: 1500, stone: 1500 } },
  { id: 'c1', title: tk('New Land'), text: tk('Found a second city'), goal: 2, get: (s) => s.cities.length, reward: { gold: 2000, wood: 2000, stone: 2000, food: 2000 } },
  { id: 's19', title: tk('The Rifts'), text: tk('Build an altar'), goal: 1, get: lvl('altar'), reward: { mana: 200 } },
  { id: 's20', title: tk('The Legacy'), text: tk('Build your race\'s unique building'), goal: 1, get: lvl('unique'), reward: { gold: 1500, souls: 10 } },
  { id: 's21', title: tk('Cavalry'), text: tk('Research Horse Riding'), goal: 1, get: (s) => (s.techs.riding ? 1 : 0), reward: { food: 2000 } },
  { id: 's22', title: tk('Ruler'), text: tk('Citadel level 7'), goal: 7, get: lvl('hall'), reward: { gold: 2500, stone: 2500 } },
  { id: 's23', title: tk('Terror of the Steppe'), text: tk('Defeat a level 8 camp'), goal: 1, get: (s) => (s.stats.bestCamp >= 8 ? 1 : 0), reward: { gold: 3000, souls: 25 } },
  { id: 's24', title: tk('Empire'), text: tk('Citadel level 10'), goal: 10, get: lvl('hall'), reward: { gold: 6000, wood: 6000, stone: 6000, souls: 50 } },
  { id: 'k3', title: tk('Lord of the Steppe'), text: tk('Defeat a level 10 camp'), goal: 1, get: (s) => (s.stats.bestCamp >= 10 ? 1 : 0), reward: { gold: 5000, food: 5000, souls: 40 }, key: true },
  { id: 's25', title: tk('Iron Will'), text: tk('Enter the Iron Age'), goal: 3, get: (s) => s.epoch, reward: { gold: 8000, wood: 8000, stone: 8000 } },
  { id: 's26', title: tk('Horseshoes and Spurs'), text: tk('Build stables'), goal: 1, get: lvl('stable'), reward: { food: 6000, gold: 3000 } },
  { id: 's27', title: tk('Temple of the Ancestors'), text: tk('Build a temple'), goal: 1, get: lvl('temple'), reward: { souls: 60 } },
  { id: 's28', title: tk('Steel Ranks'), text: tk('Research Steel'), goal: 1, get: (s) => (s.techs.steel ? 1 : 0), reward: { gold: 9000, stone: 9000 } },
  { id: 's29', title: tk('Fortress'), text: tk('Citadel level 12'), goal: 12, get: lvl('hall'), reward: { gold: 12000, wood: 12000 } },
  { id: 's30', title: tk('The Last Warlord'), text: tk('Defeat a level 15 camp'), goal: 1, get: (s) => (s.stats.bestCamp >= 15 ? 1 : 0), reward: { gold: 15000, souls: 120 } },
  { id: 's31', title: tk('Iron Empire'), text: tk('Citadel level 15'), goal: 15, get: lvl('hall'), reward: { gold: 25000, wood: 25000, stone: 25000, souls: 200 } },
];

const DAILY = [
  { id: 'd_build', text: tk('Start 3 constructions'), key: 'built', goal: 3, reward: { wood: 1, stone: 1 } },
  { id: 'd_train', text: tk('Train 10 units'), key: 'trained', goal: 10, reward: { food: 1, gold: 0.5 } },
  { id: 'd_raid', text: tk('Win 2 raids'), key: 'raids', goal: 2, reward: { gold: 1, food: 0.5 }, souls: 3 },
  { id: 'd_research', text: tk('Complete a research'), key: 'researched', goal: 1, reward: { gold: 1, wood: 0.5 } },
  { id: 'd_build5', text: tk('Start 5 constructions'), key: 'built', goal: 5, reward: { gold: 1, food: 1 } },
  { id: 'd_raid1', text: tk('Win a raid'), key: 'raids', goal: 1, reward: { food: 1, wood: 1 } },
  { id: 'd_adv', text: tk('Send the hero on 2 adventures'), key: 'adventures', goal: 2, reward: { gold: 1, stone: 1 } },
  { id: 'd_scout', text: tk('Scout a target'), key: 'scouted', goal: 1, reward: { gold: 0.5, food: 1 } },
  { id: 'd_tactic', text: tk('Win a tactical battle'), key: 'tactics', goal: 1, reward: { gold: 1, wood: 1 }, souls: 2 },
];

return { RES, RES_NAMES, resName, RACES, EPOCHS, MAX_EPOCH, EPOCH_UP, COST_GROWTH, TIME_GROWTH, BUILDINGS, UNIQUE, GRID, PLOTS, DECOR, OFF_PLOT, UNITS, UNIT_ORDER, FIGHTERS, UNIT_NAMES, unitCls, CLS_NAMES, COUNTER, WORLD_SPEED, TECHS, TECH_PROD, TACTIC, TERRAIN, MOVES, FORMATION, LOYALTY_REGEN, HERO, HERO_POINTS, SLOTS, TIERS, ITEM_FX, ITEM_NAMES, ADVENTURE, WORLD_R, OASIS_RES, OASIS_BONUS, OASIS_RANGE, OASIS_RESPAWN, CAMP_RESPAWN, CAMP_SLOTS, CAMP_START, CAMP_NAMES, PROTECTION, NIGHT, NPC_ATTACK_EVERY, PACT, NPC_CLANS, NPC_NAMES, STORY, DAILY };
})();

__m['js/games/empires/battle.js'] = (() => {
// A quick (automatic) battle between two armies. Deterministic for the same seed –
// the same result can be computed on the server too.
const { COUNTER } = __m['js/games/empires/data.js'];

function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashStr(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const mult = (a, b) => COUNTER[a]?.[b] ?? 1;

/**
 * side: [{ key, cls, n, hp, atk, def }] (atk/def already include bonuses).
 * defMult/defHp – multipliers for the defenders (wall, night bonus).
 * Returns { win: 'att' | 'def', rounds, att: [{key, n, lost, dmg}], def: [...] }.
 * Archers shoot alone in the first round; then everyone at once.
 */
function fight(attSide, defSide, seed, { maxRounds = 8, defMult = 1, defHp = 1 } = {}) {
  const rand = rng(seed);
  const prep = (side, dm = 1, hm = 1) => side.filter((g) => g.n > 0).map((g) => ({ ...g, def: g.def * dm, hp: g.hp * hm, start: g.n, dmg: 0 }));
  const A = prep(attSide), D = prep(defSide, defMult, defHp);
  const alive = (side) => side.some((g) => g.n > 0);
  let round = 0;
  while (alive(A) && alive(D) && round < maxRounds) {
    round++;
    const onlyRanged = round === 1;
    const hitA = volley(A, D, onlyRanged, rand);
    const hitD = volley(D, A, onlyRanged, rand);
    apply(D, hitA);
    apply(A, hitD);
  }
  const out = (side) => side.map((g) => ({ key: g.key, n: g.n, lost: g.start - g.n, dmg: g.n > 0 ? g.dmg / g.hp : 0 }));
  return { win: alive(A) && !alive(D) ? 'att' : 'def', rounds: round, att: out(A), def: out(D) };
}

function volley(from, to, onlyRanged, rand) {
  const hits = to.map(() => 0);
  const targets = to.map((t) => (t.n > 0 ? t.n * t.hp : 0));
  const total = targets.reduce((a, b) => a + b, 0);
  if (!total) return hits;
  for (const g of from) {
    if (g.n <= 0 || (onlyRanged && g.cls !== 'ranged')) continue;
    const power = g.n * g.atk * (0.9 + rand() * 0.2);
    to.forEach((t, i) => {
      if (!targets[i]) return;
      hits[i] += ((power * targets[i]) / total) * mult(g.cls, t.cls) * (10 / (10 + t.def * 2));
    });
  }
  return hits;
}

function apply(side, hits) {
  side.forEach((g, i) => {
    if (!hits[i] || g.n <= 0) return;
    g.dmg += hits[i];
    const dead = Math.min(g.n, Math.floor(g.dmg / g.hp));
    g.n -= dead;
    g.dmg -= dead * g.hp;
  });
}

// A rough estimate of an army's strength (for hints in the UI).
const power = (side, defMult = 1) => Math.round(side.reduce((a, g) => a + g.n * Math.sqrt(g.hp * Math.max(g.atk, 0.5) * (1 + (g.def * defMult) / 5)), 0));

return { rng, hashStr, fight, power };
})();

__m['js/games/empires/worldgen.js'] = (() => {
// Evil Empires – the world: deterministic generation from the world seed (terrain, oases,
// computer empires, spots for player cities). Pure functions only.
const { WORLD_R, OASIS_RES, NPC_NAMES, NPC_CLANS, CAMP_SLOTS } = __m['js/games/empires/data.js'];
const { hashStr } = __m['js/games/empires/battle.js'];

const RACES = ['humans', 'undead', 'orcs', 'vesheri'];

const hash2 = (seed, x, y, k = 0) => {
  let h = Math.imul(seed ^ 0x9e3779b9, 2654435761) ^ Math.imul(x + 1000, 374761393) ^ Math.imul(y + 1000, 668265263) ^ Math.imul(k + 7, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const inWorld = (x, y) => Math.abs(x) <= WORLD_R && Math.abs(y) <= WORLD_R;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const tileKey = (x, y) => `${x}|${y}`;

// Terrain: grass (buildable), forest, hills, lake, oasis.
function tileAt(seed, x, y) {
  if (!inWorld(x, y)) return { kind: 'void' };
  const v = hash2(seed, x, y);
  // "patches" – neighbouring tiles are similar
  const near = (hash2(seed, x >> 2, y >> 2, 1) + hash2(seed, (x + 2) >> 2, (y + 1) >> 2, 1)) / 2;
  if (Math.abs(x) + Math.abs(y) > 2) {
    if (v < 0.055) {
      const res = OASIS_RES[Math.floor(hash2(seed, x, y, 2) * OASIS_RES.length)];
      const lvl = 1 + Math.floor(hash2(seed, x, y, 3) * 4 + Math.hypot(x, y) / 6);
      return { kind: 'oasis', res, lvl };
    }
    if (v < 0.09 && near < 0.45) return { kind: 'lake' };
  }
  if (near > 0.62 && v < 0.55) return { kind: 'forest' };
  if (near < 0.3 && v < 0.45) return { kind: 'hills' };
  return { kind: 'grass' };
}

// Computer empires: positions, race, clan and a development "head start".
const npcCache = new Map();
function npcList(seed) {
  if (npcCache.has(seed)) return npcCache.get(seed);
  const list = NPC_NAMES.map((name, i) => {
    const ang = (i / NPC_NAMES.length) * Math.PI * 2 + hash2(seed, i, 0, 9) * 0.5;
    const rad = 7 + hash2(seed, i, 1, 9) * 11;
    let x = Math.round(Math.cos(ang) * rad), y = Math.round(Math.sin(ang) * rad);
    for (let k = 0; k < 20 && tileAt(seed, x, y).kind !== 'grass'; k++) x += k % 2 ? 1 : 0, y += k % 2 ? 0 : 1;
    return {
      id: `n${i}`, name, x, y,
      race: RACES[Math.floor(hash2(seed, i, 2, 9) * 4)],
      clan: NPC_CLANS[i % NPC_CLANS.length].id,
      head: (i % 5) * 0.6, // days of head start
    };
  });
  npcCache.set(seed, list);
  return list;
}

// A free spot for a new city (searches in a spiral from a starting point).
function findSpot(seed, start, taken, minGap = 2) {
  const ok = (x, y) => tileAt(seed, x, y).kind === 'grass' && !taken(x, y, minGap);
  for (let r = 0; r <= WORLD_R; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (const dy of r === Math.abs(dx) ? [r - Math.abs(dx)] : [r - Math.abs(dx), -(r - Math.abs(dx))]) {
        const x = start.x + dx, y = start.y + dy;
        if (inWorld(x, y) && ok(x, y)) return { x, y };
      }
    }
  }
  return null;
}

function homeStart(seed, uid) {
  const h = hashStr(`${seed}:${uid}`);
  const ang = (h % 3600) / 3600 * Math.PI * 2;
  const rad = 4 + ((h >>> 12) % 1000) / 1000 * 11;
  return { x: Math.round(Math.cos(ang) * rad), y: Math.round(Math.sin(ang) * rad) };
}

// The player's barbarian camps – around their capital.
function campSpots(seed, home) {
  return CAMP_SLOTS.map((d, i) => {
    const ang = (i / CAMP_SLOTS.length) * Math.PI * 2 + hash2(seed, home.x, home.y, 20 + i) * 0.8;
    const r = d * 1.6 + 0.6;
    return { x: Math.max(-WORLD_R, Math.min(WORLD_R, home.x + Math.round(Math.cos(ang) * r))), y: Math.max(-WORLD_R, Math.min(WORLD_R, home.y + Math.round(Math.sin(ang) * r))) };
  });
}

return { hash2, inWorld, dist, tileKey, tileAt, npcList, findSpot, homeStart, campSpots };
})();

__m['js/games/empires/tactics.js'] = (() => {
// Evil Empires – turn-based tactical battle on a hex map.
// Deterministic: the same battle + the same moves give the same result,
// so the server can verify the battle by replaying the player's moves.
// The attacker is side 'A' (the player), the defender is 'D' (the computer).
const { TACTIC, TERRAIN, MOVES, COUNTER, FORMATION } = __m['js/games/empires/data.js'];
const { rng, hashStr } = __m['js/games/empires/battle.js'];

const EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
const MELEE = ['inf', 'spear', 'hero'];

function neighbors(st, q, r) {
  return ((r & 1) ? ODD : EVEN).map(([dq, dr]) => [q + dq, r + dr]).filter(([a, b]) => a >= 0 && a < st.cols && b >= 0 && b < st.rows);
}

const cube = (q, r) => { const x = q - (r - (r & 1)) / 2; return [x, -x - r, r]; };
function hexDist(a, b) {
  const [x1, y1, z1] = cube(a.q, a.r), [x2, y2, z2] = cube(b.q, b.r);
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

const terrainAt = (st, q, r) => st.terrain[r * st.cols + q];
const alive = (st, side) => st.units.filter((u) => u.side === side && u.n > 0);
const unitAt = (st, q, r) => st.units.find((u) => u.n > 0 && u.q === q && u.r === r);
const rangeOf = (st, u) => (u.cls === 'ranged' ? 3 + (TERRAIN[terrainAt(st, u.q, u.r)].range || 0) : 1);

/**
 * A new battle. att/def: groups { key, cls, n, hp, atk, def }; opts: { defMult, defHp, formA, formD }
 * (formA/formD – battle formation: class → 'front' | 'back' | 'flank').
 */
function createBattle(seed, att, def, { defMult = 1, defHp = 1, formA = null, formD = null } = {}) {
  const cols = TACTIC.cols, rows = TACTIC.rows;
  const r = rng(hashStr(`tac:${seed}`));
  const terrain = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const deploy = x <= 1 || x >= cols - 2;
      const v = r();
      terrain.push(v < 0.14 ? 'forest' : v < 0.24 ? 'hill' : v < 0.3 && !deploy ? 'ruins' : v < 0.34 && !deploy ? 'water' : 'plain');
    }
  }
  const st = { seed: String(seed), cols, rows, terrain, units: [], turn: 1, side: 'A', over: false, win: null, defMult, defHp, k: 0, log: [] };
  let id = 0;
  const place = (groups, side, form) => {
    const F = { ...FORMATION, ...(form || {}) };
    const front = side === 'A' ? 1 : cols - 2, back = side === 'A' ? 0 : cols - 1, extra = side === 'A' ? 2 : cols - 3;
    const CENTER = [3, 2, 4, 1, 5, 0, 6], FLANK = [0, 6, 1, 5, 2, 4, 3];
    const used = new Set();
    const tryCol = (u, c, order) => {
      for (const row of order) {
        const key = `${c},${row}`;
        if (used.has(key) || terrain[row * cols + c] === 'water') continue;
        used.add(key);
        u.q = c;
        u.r = row;
        return true;
      }
      return false;
    };
    const put = (u, pos) => {
      const plan = pos === 'flank' ? [[back, FLANK], [front, FLANK]] : pos === 'back' ? [[back, CENTER], [front, CENTER]] : [[front, CENTER], [back, CENTER]];
      for (const [c, order] of [...plan, [extra, CENTER]]) if (tryCol(u, c, order)) return true;
      // if there is no room – anywhere in its own half
      for (let c = 0; c < cols; c++) if ((side === 'A' ? c < cols / 2 : c >= cols / 2) && tryCol(u, c, CENTER)) return true;
      return false;
    };
    const list = groups.filter((g) => g.n > 0).map((g, gi) => ({
      id: id++, gi, side, key: g.key, cls: g.cls === 'elite' ? 'inf' : g.cls, n: g.n, start: g.n,
      hp: g.hp * (side === 'D' ? defHp : 1), atk: g.atk, def: g.def, dmg: 0, q: 0, r: 0, moved: false, acted: false,
    }));
    const rank = { front: 0, flank: 1, back: 2 };
    for (const u of [...list].sort((a, b) => rank[F[a.cls] || 'front'] - rank[F[b.cls] || 'front'])) put(u, F[u.cls] || 'front');
    st.units.push(...list);
  };
  place(att, 'A', formA);
  place(def, 'D', formD);
  return st;
}

// Tiles the unit can reach this turn: { "q,r": cost }.
function reachable(st, u) {
  const out = new Map();
  if (u.moved || u.acted || u.n <= 0) return out;
  const mp = MOVES[u.cls] || 2;
  const enemyNear = (q, r) => neighbors(st, q, r).some(([a, b]) => { const e = unitAt(st, a, b); return e && e.side !== u.side; });
  const best = new Map([[`${u.q},${u.r}`, 0]]);
  const queue = [[u.q, u.r, 0]];
  while (queue.length) {
    queue.sort((a, b) => a[2] - b[2]);
    const [q, r, c] = queue.shift();
    if (c > (best.get(`${q},${r}`) ?? Infinity)) continue;
    if ((q !== u.q || r !== u.r) && enemyNear(q, r)) continue; // zone of control: stops here
    for (const [a, b] of neighbors(st, q, r)) {
      const cost = c + TERRAIN[terrainAt(st, a, b)].cost;
      if (cost > mp || unitAt(st, a, b)) continue;
      const key = `${a},${b}`;
      if (cost < (best.get(key) ?? Infinity)) {
        best.set(key, cost);
        out.set(key, cost);
        queue.push([a, b, cost]);
      }
    }
  }
  return out;
}

function targets(st, u) {
  if (u.acted || u.n <= 0) return [];
  const R = rangeOf(st, u);
  return st.units.filter((e) => e.n > 0 && e.side !== u.side && hexDist(u, e) <= R);
}

const mult = (a, b) => COUNTER[a]?.[b] ?? 1;

// The expected strength of a strike (without randomness) – for the AI and the hints.
function strike(st, a, t, roll = 1) {
  const ranged = a.cls === 'ranged';
  let power = a.n * a.atk * roll * mult(a.cls, t.cls);
  if (ranged && hexDist(a, t) <= 1) power *= 0.5;
  if (st.units.some((h) => h.cls === 'hero' && h.side === a.side && h.n > 0 && h !== a && hexDist(h, a) === 1)) power *= 1.1;
  if (t.hit) power *= 1.15;
  const terr = TERRAIN[terrainAt(st, t.q, t.r)];
  const tdef = terr.vsRanged && !ranged ? 1 : terr.def;
  const def = t.def * (t.side === 'D' ? st.defMult : 1);
  return (power * (10 / (10 + def * 2))) / tdef;
}

function damage(u, dmg) {
  u.dmg += dmg;
  const dead = Math.min(u.n, Math.floor(u.dmg / u.hp));
  u.n -= dead;
  u.dmg -= dead * u.hp;
  if (u.n <= 0) u.dmg = 0;
  return dead;
}

function checkOver(st) {
  const a = alive(st, 'A').length, d = alive(st, 'D').length;
  if (!a || !d) { st.over = true; st.win = d ? 'def' : 'att'; }
}

function move(st, id, q, r) {
  const u = st.units.find((x) => x.id === id);
  if (st.over || !u || u.side !== st.side || u.n <= 0) return false;
  if (!reachable(st, u).has(`${q},${r}`)) return false;
  u.q = q;
  u.r = r;
  u.moved = true;
  return true;
}

function attack(st, id, tid) {
  const a = st.units.find((x) => x.id === id);
  const t = st.units.find((x) => x.id === tid);
  if (st.over || !a || !t || a.side !== st.side || a.n <= 0 || t.n <= 0 || a.acted) return false;
  if (!targets(st, a).includes(t)) return false;
  const roll = 0.9 + rng(hashStr(`${st.seed}:${st.k++}`))() * 0.2;
  const kills = damage(t, strike(st, a, t, roll));
  let back = 0;
  if (a.cls !== 'ranged' && t.n > 0 && t.cls !== 'ranged' && hexDist(a, t) === 1) {
    const save = t.hit;
    t.hit = false;
    back = damage(a, strike(st, t, a, 1) * 0.5);
    t.hit = save;
  }
  t.hit = true;
  a.acted = true;
  a.moved = true;
  st.log.push({ turn: st.turn, a: a.id, t: t.id, kills, back });
  if (st.log.length > 60) st.log.shift();
  checkOver(st);
  return true;
}

// The AI plays all units of the side.
function ai(st, side) {
  const mine = alive(st, side).sort((a, b) => (a.cls === 'ranged' ? -1 : 0) - (b.cls === 'ranged' ? -1 : 0) || (MOVES[b.cls] || 2) - (MOVES[a.cls] || 2) || a.id - b.id);
  for (const u of mine) {
    if (st.over || u.n <= 0) continue;
    const foes = alive(st, side === 'A' ? 'D' : 'A');
    if (!foes.length) break;
    const best = (list) => list.sort((x, y) => strike(st, u, y) / y.hp - strike(st, u, x) / x.hp || x.id - y.id)[0];
    let tg = targets(st, u);
    if (u.cls === 'ranged' && tg.length) { attack(st, u.id, best(tg).id); continue; }
    if (!(u.cls !== 'ranged' && tg.length)) {
      // choosing a target: close and weak against us, with a bonus for counters
      const goal = foes.slice().sort((x, y) => hexDist(u, x) - 2 * (mult(u.cls, x.cls) > 1) - (hexDist(u, y) - 2 * (mult(u.cls, y.cls) > 1)) || x.id - y.id)[0];
      const reach = reachable(st, u);
      let pick = null, score = Infinity;
      for (const [key, cost] of reach) {
        const [q, r] = key.split(',').map(Number);
        const d = hexDist({ q, r }, goal);
        const want = u.cls === 'ranged' ? Math.abs(d - Math.min(3, rangeOf(st, u))) * 2 + (d <= 1 ? 4 : 0) : d;
        const sc = want * 10 + cost - TERRAIN[terrainAt(st, q, r)].def * 2;
        if (sc < score) { score = sc; pick = [q, r]; }
      }
      const stay = u.cls === 'ranged' ? Math.abs(hexDist(u, goal) - 3) * 2 * 10 : hexDist(u, goal) * 10;
      if (pick && score < stay) move(st, u.id, pick[0], pick[1]);
      tg = targets(st, u);
    }
    if (tg.length && !st.over) attack(st, u.id, best(tg).id);
  }
}

function endTurn(st) {
  if (st.over) return;
  if (st.side === 'A') {
    st.side = 'D';
    for (const u of st.units) { u.moved = false; u.acted = false; u.hit = false; }
    ai(st, 'D');
    if (st.over) return;
    st.turn++;
    st.side = 'A';
    for (const u of st.units) { u.moved = false; u.acted = false; u.hit = false; }
    if (st.turn > TACTIC.maxTurns) { st.over = true; st.win = 'def'; }
  }
}

function autoFinish(st) {
  for (let i = 0; i < 100 && !st.over; i++) {
    if (st.side === 'A') ai(st, 'A');
    endTurn(st);
  }
}

// The player's moves: { m: [id, q, r] }, { a: [id, targetId] }, { end: 1 }, { auto: 1 }.
function applyMove(st, mv) {
  if (st.over || !mv) return false;
  if (mv.m) return move(st, mv.m[0], mv.m[1], mv.m[2]);
  if (mv.a) return attack(st, mv.a[0], mv.a[1]);
  if (mv.end) { endTurn(st); return true; }
  if (mv.auto) { autoFinish(st); return true; }
  return false;
}

function result(st) {
  const sideOut = (side) => st.units.filter((u) => u.side === side).sort((a, b) => a.gi - b.gi)
    .map((u) => ({ key: u.key, n: u.n, lost: u.start - u.n, dmg: u.n > 0 ? u.dmg / u.hp : 0 }));
  return { win: st.win || 'def', rounds: st.turn, att: sideOut('A'), def: sideOut('D'), tactical: true };
}

// Server-side check: replays the moves; an unfinished battle is finished automatically.
function replay(b, moves) {
  const st = createBattle(b.seed, b.att, b.def, b.opts);
  for (const mv of (moves || []).slice(0, 2000)) { if (st.over) break; applyMove(st, mv); }
  if (!st.over) autoFinish(st);
  return result(st);
}

return { neighbors, hexDist, terrainAt, alive, rangeOf, createBattle, reachable, targets, strike, move, attack, ai, endTurn, autoFinish, applyMove, result, replay };
})();

__m['js/games/empires/engine.js'] = (() => {
// Evil Empires – game logic. The state is a plain JSON object; time flows
// "lazily": advance(s, t, env) computes everything that happened since the last update
// (production, construction, training, marches, battles, attacks) – even while the player is away.
// env.world (optional) connects the player to the shared world: other players, alliances, oases.
// Actions throw an Error with a message for the player when they are not possible.
const { RES, RACES, EPOCHS, MAX_EPOCH, EPOCH_UP, BUILDINGS, UNIQUE, COST_GROWTH, TIME_GROWTH, UNITS, UNIT_NAMES, FIGHTERS, unitCls, TECHS, TECH_PROD, WORLD_SPEED, HERO, ITEM_FX, ITEM_NAMES, ADVENTURE, OASIS_BONUS, OASIS_RANGE, OASIS_RESPAWN, CAMP_RESPAWN, CAMP_SLOTS, CAMP_START, CAMP_NAMES, PROTECTION, NIGHT, NPC_ATTACK_EVERY, NPC_CLANS, PACT, STORY, DAILY, TACTIC, FORMATION, LOYALTY_REGEN, resName } = __m['js/games/empires/data.js'];
const { fight, hashStr, rng, power } = __m['js/games/empires/battle.js'];
const { tileAt, npcList, dist, tileKey, campSpots, inWorld } = __m['js/games/empires/worldgen.js'];
const { replay, createBattle, autoFinish, result: tacResult } = __m['js/games/empires/tactics.js'];
const { tk } = __m['js/i18n/tk.js'];

const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

// Game time is Bulgarian time – both in the browser and on the server.
const SOFIA = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Sofia', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric' });
const sofia = (t) => Object.fromEntries(SOFIA.formatToParts(new Date(t)).map((x) => [x.type, x.value]));

const HOUR = 3600000;
const fail = (msg) => { throw new Error(msg); };
const round5 = (x) => Math.max(5, Math.round(x / 5) * 5);
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);

// ---------- new state and migration ----------
function newCity(id, name, x, y, res) {
  return { id, name, x, y, res: { gold: 300, wood: 500, stone: 400, food: 400, mana: 0, souls: 0, ...res }, b: { hall: 1 }, queue: [], train: [], units: {} };
}

function newHero() {
  return { name: tk('The Hero'), lvl: 1, xp: 0, health: 100, free: HERO.startPoints, points: { str: 0, off: 0, def: 0, res: 0 }, items: [], eq: {}, city: 'c1', state: 'home', reviveEnd: 0 };
}

function newGame(race, name, t = Date.now(), seed = (Math.random() * 2 ** 32) >>> 0, { uid = 'local', home = { x: 0, y: 0 }, worldSeed = 1 } = {}) {
  if (!RACES[race]) fail(tk('Unknown race.'));
  const spots = campSpots(worldSeed, home);
  return {
    v: 2, uid, race, name, created: t, t, speed: 1, seed, seq: 1, world: worldSeed,
    epoch: 1, techs: {}, research: null, epochUp: null,
    cities: [newCity('c1', tk('Capital'), home.x, home.y)], active: 'c1',
    marches: [], abroad: [], incoming: [], reports: [], log: [],
    camps: CAMP_SLOTS.map((d, id) => ({ id, dist: d, lvl: CAMP_START[id], respawn: 0, ...spots[id] })),
    hero: newHero(), adventures: [], advNext: t + 60000,
    oases: [], guards: {}, intel: {}, pacts: {},
    protectedUntil: t + PROTECTION * 1000, npcNext: t + PROTECTION * 1000,
    story: { claimed: [] }, daily: { day: '', prog: {}, claimed: [] },
    stats: { trained: 0, built: 0, raids: 0, researched: 0, bestCamp: 0, adventures: 0, scouted: 0, defWins: 0 },
  };
}

// Saves from the first version (a single city) are converted to the new format.
function migrate(s, { uid = 'local', home = { x: 0, y: 0 }, worldSeed = 1 } = {}) {
  if (s.v === 2) return s;
  const fresh = newGame(s.race, s.name, s.created, s.seed, { uid, home, worldSeed });
  const city = fresh.cities[0];
  Object.assign(city, { res: s.res, b: s.b, queue: s.queue || [], train: s.train || [], units: s.units || {} });
  const sp = s.speed || 1;
  Object.assign(fresh, {
    t: s.t, speed: sp, seq: s.seq, epoch: s.epoch, techs: s.techs, research: s.research, epochUp: s.epochUp,
    log: s.log || [], story: s.story, daily: s.daily, stats: { ...fresh.stats, ...s.stats },
    camps: s.camps.map((c, i) => ({ ...fresh.camps[i], lvl: c.lvl, respawn: c.respawn })),
    protectedUntil: s.t + (PROTECTION * 1000) / sp, npcNext: s.t + (PROTECTION * 1000) / sp, advNext: s.t + 60000 / sp,
  });
  // marches from the old version return home
  for (const m of s.marches || []) for (const [u, n] of Object.entries(m.units)) city.units[u] = (city.units[u] || 0) + n;
  return fresh;
}

// ---------- helpers ----------
const cityOf = (s, id) => s.cities.find((c) => c.id === id) || s.cities[0];
const lv = (c, id) => c.b[id] || 0;
const maxLv = (s, id) => Math.max(0, ...s.cities.map((c) => lv(c, id)));
const bName = (s, id) => (id === 'unique' ? UNIQUE[s.race].name : id === 'wall' && s.epoch >= 2 ? BUILDINGS.wall.name2 : (s.race === 'undead' && BUILDINGS[id].undeadName) || BUILDINGS[id].name);
const bDesc = (s, id) => (id === 'unique' ? UNIQUE[s.race].desc : (s.race === 'undead' && BUILDINGS[id].undeadDesc) || BUILDINGS[id].desc);
const uName = (s, u) => (u === 'hero' ? s.hero?.name || tk('The Hero') : UNIT_NAMES[s.race][u]);
const growth = (L) => L * 1.15 ** (L - 1);
const scaled = (s, sec) => Math.round((sec * 1000) / s.speed);

function bCost(id, L) {
  const out = {};
  for (const [k, v] of Object.entries(BUILDINGS[id].cost)) out[k] = round5(v * COST_GROWTH ** (L - 1));
  return out;
}

function bTime(s, c, id, L) {
  let t = BUILDINGS[id].time * TIME_GROWTH ** (L - 1);
  t *= Math.max(0.5, 1 - 0.04 * (lv(c, 'hall') - 1));
  if (s.race === 'humans') t *= 0.9;
  return scaled(s, t);
}

function maxLevel(s, c, id) {
  const cap = EPOCHS[s.epoch - 1].cap;
  return id === 'hall' ? cap : Math.min(cap, lv(c, 'hall'));
}

function bProd(s, id, L) {
  const base = id === 'unique' ? UNIQUE[s.race].prod : BUILDINGS[id].prod;
  if (!base || !L) return {};
  const out = {};
  for (const [k, v] of Object.entries(base)) out[k] = v * growth(L);
  return out;
}

const storageCap = (c) => Math.round(1500 * 1.5 ** lv(c, 'warehouse'));
const capOf = (c, r) => (r === 'souls' ? Infinity : r === 'mana' ? storageCap(c) / 2 : storageCap(c));
const crannyCap = (c) => (lv(c, 'cranny') ? Math.round(150 * 1.45 ** (lv(c, 'cranny') - 1)) : 0);
const trapCap = (c) => (lv(c, 'traps') ? Math.round(6 * lv(c, 'traps') * 1.25 ** (lv(c, 'traps') - 1)) : 0);
const wallBonus = (L, fort = false) => ({ def: 1 + 0.06 * L * (fort ? 1.5 : 1), hp: 1 + 0.03 * L * (fort ? 1.5 : 1) });
// How early an incoming attack is visible (depends on the watchtower).
const warnWindow = (s, c) => scaled(s, 600 + 1200 * lv(c, 'tower'));
const oasisSlots = (s) => { const L = maxLv(s, 'heroHall'); return (L >= 3) + (L >= 6) + (L >= 10); };
const allowedCities = (s) => 1 + Math.floor(maxLv(s, 'hall') / 5);
const embassyMax = (s) => 3 * maxLv(s, 'embassy');

function popCap(s, c) {
  const L = lv(c, 'houses');
  return Math.round((20 + (L ? 15 * growth(L) : 0)) * (s.race === 'undead' ? 0.85 : 1));
}

function popUsed(s, c) {
  let n = sum(c.units);
  for (const m of s.marches) if (m.from === c.id) n += sum(m.units);
  for (const a of s.abroad) if (a.from === c.id) n += sum(a.units);
  for (const b of c.train) n += b.n - b.done;
  return n;
}

const upkeepOf = (s, u) => (s.race === 'undead' ? 0 : UNITS[u].upkeep);
function upkeep(s, c) {
  let total = 0;
  const add = (units) => { for (const [u, n] of Object.entries(units)) if (UNITS[u]) total += n * upkeepOf(s, u); };
  add(c.units);
  for (const m of s.marches) if (m.from === c.id) add(m.units);
  return total;
}

const heroHome = (s, c) => s.hero.state === 'home' && s.hero.city === c.id;

// Net production per hour for each resource of the city (incl. troop upkeep).
function rates(s, c) {
  const r = Object.fromEntries(RES.map((k) => [k, 0]));
  Object.assign(r, { gold: 15, wood: 20, stone: 15, food: 20 });
  for (const id of Object.keys(c.b)) for (const [k, v] of Object.entries(bProd(s, id, lv(c, id)))) r[k] += v;
  for (const o of s.oases) if (o.city === c.id) r[o.res] *= 1 + OASIS_BONUS;
  for (const [t, k] of Object.entries(TECH_PROD)) if (s.techs[t]) r[k] *= 1.15;
  if (s.race === 'humans') for (const k of RES) r[k] *= 1.1;
  if (s.race === 'vesheri') r.mana *= 1.25;
  if (s.hero.city === c.id && s.hero.state !== 'dead') for (const k of RES) r[k] *= 1 + Math.min(25, s.hero.points.res) / 100;
  r.food -= upkeep(s, c);
  for (const k of RES) r[k] *= s.speed;
  return r;
}

function unitStats(s, u, c = s.cities[0]) {
  const d = UNITS[u];
  const cls = unitCls(s.race, u);
  let atk = 1 + 0.03 * lv(c, 'smithy'), def = 1 + 0.03 * lv(c, 'smithy');
  if (s.techs.smith) atk += 0.1;
  if (s.techs.armor) def += 0.1;
  if (s.techs.tactics && cls === 'inf') atk += 0.1;
  if (s.race === 'orcs' && (cls === 'inf' || cls === 'spear')) atk += 0.2;
  if (s.race === 'vesheri' && cls === 'ranged') atk += 0.2;
  return { cls, hp: d.hp, atk: d.atk * atk, def: d.def * def, carry: d.carry, upkeep: upkeepOf(s, u), speed: d.speed };
}

function uCost(s, u) {
  const m = s.race === 'undead' ? 0.8 : s.race === 'vesheri' ? 1.2 : 1;
  const out = {};
  for (const [k, v] of Object.entries(UNITS[u].cost)) out[k] = Math.round(v * m);
  return out;
}

function uTime(s, c, u) {
  let t = UNITS[u].time * Math.max(0.5, 1 - 0.04 * (lv(c, 'barracks') - 1));
  if (s.race === 'orcs') t *= Math.max(0.6, 1 - 0.05 * lv(c, 'unique'));
  if (UNITS[u].cls === 'cav') t *= Math.max(0.6, 1 - 0.05 * lv(c, 'stable'));
  return scaled(s, t);
}

function tTime(s, id) {
  let t = TECHS[id].time * Math.max(0.5, 1 - 0.05 * (maxLv(s, 'academy') - 1));
  if (s.race === 'orcs') t *= 1.2;
  return scaled(s, t);
}

const mul = (cost, n) => Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, v * n]));
const canPay = (c, cost) => Object.entries(cost).every(([k, v]) => c.res[k] >= v - 1e-6);
function pay(s, c, cost) {
  const miss = Object.entries(cost).filter(([k, v]) => c.res[k] < v - 1e-6).map(([k]) => resName(s.race, k).toLowerCase());
  if (miss.length) fail(tk('Not enough: {0}.', miss.join(', ')));
  for (const [k, v] of Object.entries(cost)) c.res[k] = Math.max(0, c.res[k] - v);
}

function addRes(c, bundle, capped) {
  for (const [k, v] of Object.entries(bundle)) {
    if (!v) continue;
    c.res[k] = capped ? Math.max(c.res[k], Math.min(capOf(c, k), c.res[k] + v)) : c.res[k] + v;
  }
}

function log(s, t, text, kind = 'info') {
  s.log.push({ id: s.seq++, t, text, kind });
  if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
}

function report(s, r) {
  s.reports.unshift({ id: s.seq++, ...r });
  if (s.reports.length > 30) s.reports.length = 30;
}

// ---------- hero ----------
const itemOf = (it) => ({ ...it, name: ITEM_NAMES[it.slot][it.tier - 1], val: ITEM_FX[it.slot].val[it.tier - 1], text: ITEM_FX[it.slot].text(ITEM_FX[it.slot].val[it.tier - 1]) });
const eqVal = (s, slot) => { const it = s.hero.items.find((i) => i.id === s.hero.eq[slot]); return it ? ITEM_FX[slot].val[it.tier - 1] : 0; };

function heroStats(s) {
  const h = s.hero;
  return {
    atk: 12 + 4 * h.points.str + eqVal(s, 'weapon'),
    hp: 70 + 15 * h.lvl + eqVal(s, 'armor'),
    def: 3 + 0.5 * h.lvl,
    armorRed: Math.round(eqVal(s, 'armor') / 7) / 100,
    xpBonus: eqVal(s, 'helmet') / 100,
    speed: HERO.speed * (1 + eqVal(s, 'horse') / 100),
    regen: HERO.regen + eqVal(s, 'amulet') + 3 * lv(cityOf(s, h.city), 'temple'),
    off: Math.min(100, h.points.off) * 0.002,
    def2: Math.min(100, h.points.def) * 0.002,
  };
}

const heroGroup = (s) => { const st = heroStats(s); return { key: 'hero', cls: 'hero', n: 1, hp: st.hp, atk: st.atk, def: st.def, carry: 0 }; };

function heroXp(s, t, xp) {
  const h = s.hero;
  h.xp += Math.round(xp * (1 + heroStats(s).xpBonus));
  while (h.xp >= HERO.xpFor(h.lvl)) {
    h.xp -= HERO.xpFor(h.lvl);
    h.lvl++;
    h.free += HERO.pointsPerLevel;
    log(s, t, tk('{0} reached level {1}!', h.name, h.lvl), 'win');
  }
}

// The hero's wounds after a battle: g – the result for the 'hero' group.
function heroWounds(s, t, g) {
  if (!g) return;
  const h = s.hero;
  if (g.n <= 0) {
    h.health = 0;
    h.state = 'dead';
    log(s, t, tk('{0} fell in battle. Revive them in the Hall of Heroes.', h.name), 'loss');
  } else h.health = Math.max(1, h.health - g.dmg * 100 * (1 - heroStats(s).armorRed));
}

function assignPoint(s, key) {
  if (!s.hero.free) fail(tk('You have no free points.'));
  if (!own(s.hero.points, key)) fail(tk('No such skill.'));
  s.hero.points[key]++;
  s.hero.free--;
}

function equip(s, itemId) {
  const it = s.hero.items.find((i) => i.id === itemId);
  if (!it) fail(tk('No such item.'));
  if (s.hero.state !== 'home') fail(tk('The hero must be at home.'));
  s.hero.eq[it.slot] = it.id;
}

function unequip(s, slot) {
  if (s.hero.state !== 'home') fail(tk('The hero must be at home.'));
  delete s.hero.eq[slot];
}

function sellItem(s, t, cid, itemId) {
  const i = s.hero.items.findIndex((x) => x.id === itemId);
  if (i < 0) fail(tk('No such item.'));
  const [it] = s.hero.items.splice(i, 1);
  if (s.hero.eq[it.slot] === it.id) delete s.hero.eq[it.slot];
  addRes(cityOf(s, cid), { gold: 100 * it.tier ** 2, souls: it.tier * 2 }, false);
}

const reviveCost = (s) => ({ gold: Math.round(150 * s.hero.lvl ** 1.3), food: Math.round(200 * s.hero.lvl ** 1.2), souls: s.hero.lvl });
const reviveTime = (s) => scaled(s, 1200 + 600 * s.hero.lvl);

function reviveHero(s, t, cid, env) {
  advance(s, t, env);
  const c = cityOf(s, cid);
  if (s.hero.state !== 'dead') fail(tk('The hero is alive.'));
  if (s.hero.reviveEnd) fail(tk('The hero is already being revived.'));
  if (!lv(c, 'heroHall')) fail(tk('A Hall of Heroes is required in this city.'));
  pay(s, c, reviveCost(s));
  s.hero.city = c.id;
  s.hero.reviveEnd = t + reviveTime(s);
}

// ---------- time ----------
function accrue(s, to) {
  if (to <= s.t) return;
  const hours = (to - s.t) / HOUR;
  for (const c of s.cities) {
    const r = rates(s, c);
    for (const k of RES) {
      const d = r[k] * hours;
      const cap = capOf(c, k);
      if (d > 0) { if (c.res[k] < cap) c.res[k] = Math.min(cap, c.res[k] + d); }
      else if (d < 0) c.res[k] = Math.max(0, c.res[k] + d);
    }
  }
  for (const c of s.cities) if (c.loyalty != null && c.loyalty < 100) c.loyalty = Math.min(100, c.loyalty + LOYALTY_REGEN * hours * s.speed);
  const h = s.hero;
  if (h.state !== 'dead') h.health = Math.min(100, h.health + heroStats(s).regen * hours * s.speed);
  s.t = to;
}

function nextEvent(s, env) {
  let best = null;
  const take = (t, run) => { if (t != null && (!best || t < best.t)) best = { t, run }; };
  for (const c of s.cities) {
    for (const q of c.queue) take(q.end, () => finishBuild(s, c, q));
    if (c.train.length) {
      const b = c.train[0];
      take(b.start + b.each * (b.done + 1), () => finishUnit(s, c, b));
    }
  }
  if (s.research) take(s.research.end, () => finishResearch(s));
  if (s.epochUp) take(s.epochUp.end, () => finishEpoch(s));
  for (const m of s.marches) {
    if (m.phase === 'go') take(m.arrive, () => arrive(s, m, env));
    else if (m.phase === 'back') take(m.back, () => comeBack(s, m));
    else if (m.phase === 'battle') take(m.battle.expires, () => { const b = m.battle; finishBattleAt(s, m, env, b.def.length ? replay(b, []) : emptyWin(b.att), b.expires); });
  }
  for (const c of s.camps) if (c.respawn) take(c.respawn, () => { c.respawn = 0; c.lvl = Math.min(campMax(s), c.lvl + 1); });
  for (const g of Object.values(s.guards)) if (g.respawn) take(g.respawn, () => { g.respawn = 0; g.alive = 1; });
  if (s.hero.reviveEnd) take(s.hero.reviveEnd, () => { Object.assign(s.hero, { reviveEnd: 0, state: 'home', health: 100 }); log(s, s.t, tk('{0} has returned to life.', s.hero.name), 'win'); });
  take(s.advNext, () => spawnAdventure(s));
  for (const a of s.adventures) take(a.expires, () => s.adventures.splice(s.adventures.indexOf(a), 1));
  take(s.npcNext, () => launchNpc(s, s.npcNext, env));
  for (const inc of s.incoming) take(inc.arrive, () => npcArrives(s, inc, env));
  if (env?.world) for (const inc of env.world.incomingFor(s.uid)) take(inc.arrive, () => pvpArrives(s, inc, env));
  return best;
}

function advance(s, to = Date.now(), env = null) {
  processOutcomes(s, env);
  // marches waiting for the result of a battle with another player
  for (const m of [...s.marches]) if (m.phase === 'wait') tryPvpResult(s, m, env);
  for (let guard = 0; guard < 100000; guard++) {
    const ev = nextEvent(s, env);
    if (!ev || ev.t > to) break;
    accrue(s, ev.t);
    ev.run();
  }
  accrue(s, to);
  return s;
}

function setSpeed(s, t, speed, env) {
  advance(s, t, env);
  const k = s.speed / speed;
  const rescale = (x) => (x && x > t ? t + (x - t) * k : x);
  s.protectedUntil = rescale(s.protectedUntil);
  s.npcNext = rescale(s.npcNext);
  s.advNext = rescale(s.advNext);
  s.speed = speed;
}

// ---------- daily missions ----------
const dayKey = (t) => { const p = sofia(t); return `${p.year}-${+p.month}-${+p.day}`; };
function ensureDaily(s, t) { const day = dayKey(t); if (s.daily.day !== day) s.daily = { day, prog: {}, claimed: [] }; }
function bump(s, t, key, n = 1) {
  s.stats[key] = (s.stats[key] || 0) + n;
  ensureDaily(s, t);
  s.daily.prog[key] = (s.daily.prog[key] || 0) + n;
}

function dailyList(s, t = Date.now()) {
  ensureDaily(s, t);
  const rand = rng(hashStr(`${s.seed}:${s.daily.day}`));
  const pool = [...DAILY];
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  const scale = 150 * maxLv(s, 'hall') ** 1.4;
  return out.map((d) => ({
    ...d,
    have: Math.min(d.goal, s.daily.prog[d.key] || 0),
    claimed: s.daily.claimed.includes(d.id),
    prize: { ...Object.fromEntries(Object.entries(d.reward).map(([k, v]) => [k, Math.round((v * scale) / 10) * 10])), ...(d.souls ? { souls: d.souls } : {}) },
  }));
}

function claimDaily(s, t, cid, id, env) {
  advance(s, t, env);
  const d = dailyList(s, t).find((x) => x.id === id);
  if (!d || d.claimed) fail(tk('The reward has already been claimed.'));
  if (d.have < d.goal) fail(tk('The mission is not complete yet.'));
  s.daily.claimed.push(id);
  addRes(cityOf(s, cid), d.prize, false);
}

function storyList(s) {
  return STORY.map((m) => ({ ...m, text: (s.race === 'undead' && m.undeadText) || m.text, have: Math.min(m.goal, m.get(s)), claimed: s.story.claimed.includes(m.id) }));
}

function claimStory(s, t, cid, id, env) {
  advance(s, t, env);
  const m = storyList(s).find((x) => x.id === id);
  if (!m || m.claimed) fail(tk('The reward has already been claimed.'));
  if (m.have < m.goal) fail(tk('The mission is not complete yet.'));
  s.story.claimed.push(id);
  addRes(cityOf(s, cid), m.reward, false);
}

// ---------- construction ----------
const buildSlots = (s) => (s.techs.logistics ? 2 : 1);

function buildState(s, c, id) {
  const def = BUILDINGS[id];
  const L = lv(c, id);
  const q = c.queue.find((x) => x.id === id);
  if (q) return { status: 'building', q };
  if (def.epoch > s.epoch) return { status: 'locked', why: tk('Unlocks in the {0}.', EPOCHS[def.epoch - 1].name) };
  if (def.tech && !s.techs[def.tech]) return { status: 'locked', why: tk('Requires the technology "{0}".', TECHS[def.tech].name) };
  for (const [b, n] of Object.entries(def.need || {})) if (lv(c, b) < n) return { status: 'locked', why: tk('Requires: {0} level {1}.', bName(s, b), n) };
  if (L >= EPOCHS[s.epoch - 1].cap) return { status: 'max', why: s.epoch >= MAX_EPOCH ? tk('Maximum level in this version.') : tk('Maximum level for this age – advance to the next one.') };
  if (L >= maxLevel(s, c, id)) return { status: 'max', why: tk('Upgrade the Citadel first.') };
  if (c.queue.length >= buildSlots(s)) return { status: 'busy', why: tk('The builders are busy.') };
  return { status: 'ok' };
}

function build(s, t, cid, id, env) {
  advance(s, t, env);
  const c = cityOf(s, cid);
  if (!own(BUILDINGS, id)) fail(tk('No such building.'));
  const st = buildState(s, c, id);
  if (st.status !== 'ok') fail(st.status === 'building' ? tk('Already under construction.') : st.why);
  const L = lv(c, id) + 1;
  const cost = bCost(id, L);
  pay(s, c, cost);
  c.queue.push({ id, lvl: L, start: t, end: t + bTime(s, c, id, L), cost });
  bump(s, t, 'built');
}

function cancelBuild(s, t, cid, id, env) {
  advance(s, t, env);
  const c = cityOf(s, cid);
  const i = c.queue.findIndex((q) => q.id === id);
  if (i < 0) fail(tk('No such construction.'));
  const [q] = c.queue.splice(i, 1);
  addRes(c, mul(q.cost, 0.8), false);
}

function finishBuild(s, c, q) {
  c.queue.splice(c.queue.indexOf(q), 1);
  c.b[q.id] = q.lvl;
  const where = s.cities.length > 1 ? ` (${c.name})` : '';
  log(s, q.end, q.lvl === 1 ? tk('Construction complete: {0}{1}.', bName(s, q.id), where) : tk('{0} reached level {1}{2}.', bName(s, q.id), q.lvl, where), 'build');
}

// ---------- troops ----------
function unitLock(s, c, u) {
  const d = UNITS[u];
  if (d.epoch > s.epoch) return tk('Unlocks in the {0}.', EPOCHS[d.epoch - 1].name);
  if (!lv(c, 'barracks')) return tk('Barracks required.');
  if (d.tech && !s.techs[d.tech]) return tk('Requires the technology "{0}".', TECHS[d.tech].name);
  if (d.barracks && lv(c, 'barracks') < d.barracks) return tk('Barracks level {0} required.', d.barracks);
  if (d.hall && lv(c, 'hall') < d.hall) return tk('Citadel level {0} required.', d.hall);
  if (d.stable && lv(c, 'stable') < d.stable) return tk('Stables required.');
  if (d.unique && !lv(c, 'unique')) return tk('The building "{0}" is required.', UNIQUE[s.race].name);
  return null;
}

function maxTrain(s, c, u) {
  if (unitLock(s, c, u)) return 0;
  const cost = uCost(s, u);
  let n = popCap(s, c) - popUsed(s, c);
  for (const [k, v] of Object.entries(cost)) n = Math.min(n, Math.floor(c.res[k] / v));
  const up = upkeepOf(s, u);
  if (up) n = Math.min(n, Math.floor(rates(s, c).food / s.speed / up));
  return Math.max(0, n);
}

function train(s, t, cid, u, n, env) {
  advance(s, t, env);
  const c = cityOf(s, cid);
  n = Math.floor(n);
  if (!own(UNITS, u) || !(n > 0)) fail(tk('Choose an amount.'));
  const lock = unitLock(s, c, u);
  if (lock) fail(lock);
  if (c.train.length >= 5) fail(tk('The training queue is full.'));
  if (popUsed(s, c) + n > popCap(s, c)) fail(tk('No room – build more houses.'));
  if (upkeepOf(s, u) && rates(s, c).food / s.speed - n * upkeepOf(s, u) < 0) fail(tk('{0} will not be enough for them – upgrade the farm.', resName(s.race, 'food')));
  pay(s, c, mul(uCost(s, u), n));
  const last = c.train[c.train.length - 1];
  c.train.push({ u, n, done: 0, start: last ? last.start + last.each * last.n : t, each: uTime(s, c, u) });
}

function finishUnit(s, c, b) {
  const t = b.start + b.each * (b.done + 1);
  b.done++;
  c.units[b.u] = (c.units[b.u] || 0) + 1;
  bump(s, t, 'trained');
  if (b.done >= b.n) {
    c.train.shift();
    log(s, t, tk('Trained: {0} × {1}.', b.n, uName(s, b.u)), 'train');
  }
}

// ---------- science and ages ----------
function techState(s, id) {
  const d = TECHS[id];
  if (s.techs[id]) return { status: 'done' };
  if (s.research?.id === id) return { status: 'active' };
  if (d.epoch > s.epoch) return { status: 'locked', why: `${EPOCHS[d.epoch - 1].name}` };
  if (maxLv(s, 'academy') < d.academy) return { status: 'locked', why: tk('Academy level {0}', d.academy) };
  const miss = (d.req || []).filter((r) => !s.techs[r]);
  if (miss.length) return { status: 'locked', why: tk('Requires: ') + miss.map((r) => TECHS[r].name).join(', ') };
  if (s.research) return { status: 'busy', why: tk('The academy is busy.') };
  return { status: 'ok' };
}

function research(s, t, cid, id, env) {
  advance(s, t, env);
  if (!own(TECHS, id)) fail(tk('No such technology.'));
  const st = techState(s, id);
  if (st.status !== 'ok') fail(st.status === 'done' ? tk('Already researched.') : st.status === 'active' ? tk('Being researched.') : st.why);
  pay(s, cityOf(s, cid), TECHS[id].cost);
  s.research = { id, start: t, end: t + tTime(s, id) };
}

function finishResearch(s) {
  const { id, end } = s.research;
  s.research = null;
  s.techs[id] = true;
  bump(s, end, 'researched');
  log(s, end, tk('Researched: {0}.', TECHS[id].name), 'tech');
}

function epochReqs(s) {
  const next = s.epoch + 1;
  const spec = EPOCH_UP[next];
  if (!spec) return null;
  const story = STORY.find((m) => m.id === spec.story);
  return {
    next, spec,
    list: [
      { text: tk('Citadel level {0}', spec.hall), ok: maxLv(s, 'hall') >= spec.hall },
      { text: tk('Research "{0}"', TECHS[spec.tech].name), ok: !!s.techs[spec.tech] },
      { text: tk('Mission "{0}"', story.title), ok: story.get(s) >= story.goal },
    ],
  };
}

function advanceEpoch(s, t, cid, env) {
  advance(s, t, env);
  if (s.epochUp) fail(tk('The empire is already entering a new age.'));
  if (s.epoch >= MAX_EPOCH) fail(tk('The next age comes in a new version of the game.'));
  const r = epochReqs(s);
  if (r.list.some((x) => !x.ok)) fail(tk('Not all conditions are met.'));
  pay(s, cityOf(s, cid), r.spec.cost);
  s.epochUp = { to: r.next, start: t, end: t + scaled(s, r.spec.time) };
}

function finishEpoch(s) {
  const { to, end } = s.epochUp;
  s.epochUp = null;
  s.epoch = to;
  log(s, end, tk('The empire entered the {0}!', EPOCHS[to - 1].name), 'epoch');
}

// ---------- opponents: camps, oases, computer empires ----------
const campMax = (s) => (s.epoch >= 3 ? 18 : s.epoch >= 2 ? 12 : 5);
const campName = (c) => (c.lvl === 5 ? tk('Warlord\'s Camp') : CAMP_NAMES[c.id % CAMP_NAMES.length]);

const barb = (key, n, k = 1) => { const d = UNITS[key]; return { key, n, cls: d.cls, hp: d.hp, atk: d.atk * k, def: d.def * k, carry: d.carry }; };

// Camps up to level 5 have only infantry and slingers – the same as the player.
function campArmy(lvl) {
  const base = Math.round(4.2 * lvl ** 1.4);
  return [
    ['warrior', base],
    ['slinger', lvl >= 2 ? Math.round(base * 0.45) : 0],
    ['spear', lvl >= 6 ? Math.round(base * 0.35) : 0],
    ['archer', lvl >= 6 ? Math.round(base * 0.3) : 0],
    ['rider', lvl >= 7 ? Math.round(base * 0.2) : 0],
    ['elite', lvl === 5 ? 3 : lvl >= 8 ? Math.round(lvl * 0.5) : 0],
    ['crossbow', lvl >= 11 ? Math.round(base * 0.2) : 0],
    ['knight', lvl >= 12 ? Math.round(base * 0.12) : 0],
    ['pike', lvl >= 13 ? Math.round(base * 0.2) : 0],
  ].filter(([, n]) => n > 0).map(([k, n]) => barb(k, n));
}

function campLoot(lvl) {
  const f = lvl ** 1.6;
  return { gold: Math.round(80 * f), wood: Math.round(140 * f), stone: Math.round(120 * f), food: Math.round(140 * f), souls: lvl >= 3 ? lvl : 0 };
}

// Oasis: guarded by beasts (the same strength as a camp of its level).
function oasisInfo(s, x, y, env) {
  const tile = tileAt(s.world, x, y);
  if (tile.kind !== 'oasis') return null;
  const key = tileKey(x, y);
  const g = s.guards[key] || { alive: 1, respawn: 0 };
  const mine = s.oases.find((o) => o.key === key);
  const owner = mine ? s.uid : env?.world?.oasisOwner(key)?.uid || null;
  const army = owner ? [] : campArmy(tile.lvl).map((u) => ({ ...u, n: Math.round(u.n * g.alive) })).filter((u) => u.n > 0);
  return { key, x, y, res: tile.res, lvl: tile.lvl, guards: army, respawn: g.respawn, owner, ownerName: mine ? s.name : env?.world?.oasisOwner(key)?.name, mine: !!mine };
}

function npcLevel(s, npc, t, env) {
  const created = env?.world?.created ?? s.created;
  const days = Math.max(0, (t - created) / (24 * HOUR)) * s.speed;
  return Math.min(30, Math.round((1 + npc.head + days * 0.45) * 10) / 10);
}

function npcInfo(s, npc, t, env) {
  const L = npcLevel(s, npc, t, env);
  const st = env?.world?.npcState(npc.id) || { lost: 0, lostT: 0, plunder: 0, plunderT: 0 };
  const rec = (v, since) => Math.max(0, v - ((t - since) / HOUR) * 0.06 * s.speed);
  const lost = rec(st.lost, st.lostT), plunder = rec(st.plunder, st.plunderT);
  const n = Math.floor(L);
  const base = Math.round(6 * n ** 1.45);
  const k = 1 + L * 0.02;
  const army = [
    barb('warrior', base, k), barb('slinger', Math.round(base * 0.5), k),
    barb('spear', n >= 6 ? Math.round(base * 0.35) : 0, k), barb('archer', n >= 6 ? Math.round(base * 0.3) : 0, k),
    barb('rider', n >= 8 ? Math.round(base * 0.2) : 0, k), barb('elite', n >= 10 ? Math.round(n * 0.5) : 0, k),
    barb('pike', n >= 14 ? Math.round(base * 0.2) : 0, k), barb('crossbow', n >= 14 ? Math.round(base * 0.25) : 0, k),
    barb('knight', n >= 16 ? Math.round(base * 0.12) : 0, k),
  ].map((g) => ({ ...g, n: Math.round(g.n * (1 - lost)) })).filter((g) => g.n > 0);
  const f = (1 - plunder) * L ** 1.4;
  return {
    ...npc, lvl: L, army, lost, plunder, scouts: Math.round(2 * L),
    wall: Math.max(0, Math.floor(L / 2) - Math.max(0, (st.wallDmg || 0) - Math.floor(((t - (st.wallT || t)) / (24 * HOUR)) * s.speed))),
    loyalty: Math.min(100, (st.loyalty ?? 100) + ((t - (st.loyT || t)) / HOUR) * LOYALTY_REGEN * s.speed),
    owner: st.owner || null,
    pile: { gold: Math.round(200 * f), wood: Math.round(300 * f), stone: Math.round(260 * f), food: Math.round(300 * f) },
    score: Math.round(60 * L ** 1.8),
    clanInfo: NPC_CLANS.find((c) => c.id === npc.clan),
  };
}

const npcs = (s) => npcList(s.world);
// Rulers not yet conquered by a player.
const activeNpcs = (s, env) => npcs(s).filter((n) => !env?.world?.npcState(n.id)?.owner);

// ---------- defense ----------
const isProtected = (s, t = Date.now()) => t < s.protectedUntil;
// Hour (with minutes) and month in Bulgarian time – for day and night in the city.
const localHour = (t) => (+sofia(t).hour % 24) + new Date(t).getMinutes() / 60;
const localMonth = (t) => +sofia(t).month;
const isNight = (t) => { const h = +sofia(t).hour % 24; return h >= NIGHT.from && h < NIGHT.to; };

function score(s) {
  let b = 0;
  for (const c of s.cities) b += Object.values(c.b).reduce((a, L) => a + L * L, 0);
  const pop = s.cities.reduce((a, c) => a + popUsed(s, c), 0);
  return Math.round(b * 10 + Object.keys(s.techs).length * 50 + pop * 2 + (s.epoch - 1) * 500 + s.hero.lvl * 30);
}

// Morale: a strong attacker hits a much weaker one less hard.
const morale = (attScore, defScore) => (attScore > defScore && defScore > 0 ? Math.max(0.5, (defScore / attScore) ** 0.35) : 1);

function endProtection(s, t) {
  if (isProtected(s, t)) {
    s.protectedUntil = t;
    s.npcNext = t + scaled(s, 6 * 3600);
  }
}

const pactCost = (s) => ({ gold: 400 * s.epoch + 150 * maxLv(s, 'hall') });
function buyPact(s, t, cid, clanId, env) {
  advance(s, t, env);
  if (!NPC_CLANS.some((c) => c.id === clanId)) fail(tk('No such clan.'));
  pay(s, cityOf(s, cid), pactCost(s));
  s.pacts[clanId] = Math.max(s.pacts[clanId] || 0, t) + scaled(s, PACT.time);
}

// The city's defenders: the troops at home, the hero and reinforcements from allies.
function defenders(s, c, env) {
  const side = FIGHTERS.filter((u) => c.units[u] > 0).map((u) => ({ key: u, n: c.units[u], ...unitStats(s, u, c) }));
  if (heroHome(s, c)) side.push(heroGroup(s));
  const stationed = env?.world?.stationedAt(s.uid, c.id) || [];
  for (const st of stationed) for (const g of st.groups) if (g.n > 0) side.push({ ...g, stId: st.id });
  return { side, stationed };
}

// Preparing a battle in a city: traps, defenders, multipliers (wall, night, tower, hero).
function prepareDefense(s, c, att, t, env) {
  let trapped = 0;
  const groups = att.groups.map((g) => ({ ...g }));
  let cap = trapCap(c);
  for (const g of [...groups].sort((a, b) => b.n - a.n)) {
    if (cap <= 0 || g.key === 'hero') continue;
    const k = Math.min(g.n, cap);
    g.n -= k;
    cap -= k;
    trapped += k;
  }
  const { side } = defenders(s, c, env);
  const wb = wallBonus(lv(c, 'wall'), s.techs.fortify);
  const night = isNight(t) ? NIGHT.bonus : 1;
  const heroDef = (heroHome(s, c) ? 1 + heroStats(s).def2 : 1) * (1 + 0.02 * lv(c, 'tower'));
  return {
    att: groups.filter((g) => g.n > 0), side, trapped, night: night > 1,
    opts: { defMult: wb.def * night * heroDef, defHp: wb.hp, formA: att.formation || null, formD: c.formation || null },
  };
}

// Automatic battle on the tactical map (formations matter).
function autoBattle(seed, att, def, opts) {
  if (!def.length) return { win: 'att', rounds: 0, att: att.map((g) => ({ key: g.key, n: g.n, lost: 0, dmg: 0 })), def: [] };
  const st = createBattle(seed, att, def, opts);
  autoFinish(st);
  return tacResult(st);
}

/**
 * Consequences of a battle in a city: losses (relative to the start), loot, siege, loyalty, report.
 * side – the defenders as they were at the start of the battle.
 */
function resolveDefense(s, c, att, prep, r, t, env) {
  const win = r.win === 'att' && r.att.some((g) => g.n > 0);
  const lostOf = (i) => r.def[i]?.lost || 0;
  const touched = new Map();
  prep.side.forEach((src, i) => {
    const g = r.def[i];
    if (!g) return;
    if (src.key === 'hero') { if (heroHome(s, c)) heroWounds(s, t, g); }
    else if (src.stId) touched.set(src.stId, [...(touched.get(src.stId) || []), [src.key, lostOf(i)]]);
    else c.units[src.key] = Math.max(0, (c.units[src.key] || 0) - lostOf(i));
  });
  if (env?.world) {
    for (const [id, losses] of touched) {
      const st = env.world.stationedById(id);
      if (st) env.world.setStationed(id, st.groups.map((g) => ({ ...g, n: Math.max(0, g.n - (losses.find(([k]) => k === g.key)?.[1] || 0)) })));
    }
  }
  const loot = {};
  const siege = {};
  let captured = null;
  if (win) {
    const carryOf = (k) => att.groups.find((x) => x.key === k)?.carry || UNITS[k]?.carry || 0;
    const room = r.att.reduce((a, g) => a + g.n * carryOf(g.key), 0) * (att.lootBoost || 1);
    const hide = crannyCap(c) * (att.crannyFactor ?? 1);
    const avail = Object.fromEntries(['gold', 'wood', 'stone', 'food'].map((k) => [k, Math.max(0, c.res[k] - hide)]));
    const total = sum(avail);
    const share = total ? Math.min(1, room / total) : 0;
    for (const [k, v] of Object.entries(avail)) {
      loot[k] = Math.floor(v * share);
      c.res[k] -= loot[k];
    }
    // catapults: the wall and the buildings
    const rr = rng(hashStr(`${att.seed}:siege`));
    const cats = r.att.find((g) => g.key === 'catapult')?.n || 0;
    if (cats) {
      const hit = Math.min(lv(c, 'wall'), Math.floor(cats / 6));
      if (hit) { c.b.wall -= hit; siege.wall = hit; }
      const ids = Object.keys(c.b).filter((b) => b !== 'hall' && b !== 'wall' && c.b[b] > 0);
      siege.buildings = [];
      for (let i = 0; i < Math.min(3, Math.floor(cats / 10)) && ids.length; i++) {
        const b = ids.splice(Math.floor(rr() * ids.length), 1)[0];
        c.b[b]--;
        siege.buildings.push(bName(s, b));
      }
    }
    // noblemen: loyalty
    const nobles = r.att.find((g) => g.key === 'noble')?.n || 0;
    if (nobles) {
      let drop = 0;
      for (let i = 0; i < Math.min(3, nobles); i++) drop += 20 + Math.floor(rr() * 11);
      c.loyalty = (c.loyalty ?? 100) - drop;
      siege.loyalty = Math.max(0, Math.round(c.loyalty));
      if (c.loyalty <= 0) {
        if (c.id === s.cities[0].id) { c.loyalty = 1; siege.note = tk('The capital cannot be conquered.'); }
        else if (!att.canConquer) { c.loyalty = 1; siege.note = tk('The attacker has no room for a new city.'); }
        else captured = captureCity(s, c, t, env);
      }
    }
  }
  if (!win) bump(s, t, 'defWins');
  // the city burns after a siege (for the map)
  if (!captured && (siege.wall || siege.buildings?.length || siege.loyalty != null)) c.burnT = t;
  report(s, {
    kind: 'defense', t, title: captured ? tk('City conquered: {0}', c.name) : `${win ? tk('The city was plundered') : tk('The attack was repelled')}: ${c.name}`, win: !win, enemy: att.name,
    att: r.att, def: r.def.map((g, i) => ({ ...g, key: prep.side[i]?.key || g.key, ally: prep.side[i]?.stId ? true : undefined })), loot, trapped: prep.trapped, night: prep.night, wall: lv(c, 'wall'), rounds: r.rounds, siege, tactical: r.tactical,
  });
  log(s, t, captured ? tk('{0} conquered {1}!', att.name, c.name) : win ? tk('{0} plundered {1}!', att.name, c.name) : tk('{0} repelled the attack of {1}.', c.name, att.name), win ? 'loss' : 'win');
  return { win, loot, trapped: prep.trapped, att: r.att, def: r.def, rounds: r.rounds, siege, captured };
}

// The city passes to the attacker: buildings and resources (without the troops).
function captureCity(s, c, t, env) {
  const data = { name: c.name, x: c.x, y: c.y, b: { ...c.b }, res: { ...c.res } };
  s.cities.splice(s.cities.indexOf(c), 1);
  for (const o of s.oases.filter((o) => o.city === c.id)) env?.world?.setOasisOwner(o.key, null);
  s.oases = s.oases.filter((o) => o.city !== c.id);
  s.incoming = s.incoming.filter((x) => x.city !== c.id);
  if (s.hero.city === c.id) { s.hero.city = s.cities[0].id; if (s.hero.state === 'home') s.hero.health = Math.min(s.hero.health, 30); }
  for (const m of s.marches) if (m.from === c.id) m.from = s.cities[0].id;
  for (const st of env?.world?.stationedAt(s.uid, c.id) || []) env.world.sendBackStationed?.(st.id);
  return data;
}

// A city obtained by conquest (from a player or from a computer ruler).
function addCapturedCity(s, t, data) {
  const id = `c${s.seq++}`;
  const city = newCity(id, data.name, data.x, data.y, data.res);
  city.b = { ...data.b };
  city.loyalty = 30;
  city.captured = t;
  s.cities.push(city);
  report(s, { kind: 'found', t, title: tk('Conquered city: {0} ({1}|{2})', data.name, data.x, data.y), win: true });
  log(s, t, tk('You conquered {0}!', data.name), 'epoch');
}

/**
 * Battle in a player's city (immediate, automatic). att: { name, groups, lootBoost, crannyFactor, seed, formation, canConquer }.
 */
function defendCity(s, c, att, t, env) {
  const prep = prepareDefense(s, c, att, t, env);
  const r = autoBattle(att.seed, prep.att, prep.side, prep.opts);
  return resolveDefense(s, c, att, prep, r, t, env);
}

// Results of tactical battles against my cities, played by the attackers.
function processOutcomes(s, env) {
  const w = env?.world;
  if (!w?.outcome || !s.pendingDef) return;
  for (const [id, p] of Object.entries(s.pendingDef)) {
    const r = w.outcome(id);
    if (!r) continue;
    const c = s.cities.find((x) => x.id === p.city);
    delete s.pendingDef[id];
    w.clearOutcome(id);
    if (!c) { w.putResult(id, { win: true, loot: {}, trapped: 0, att: r.att, def: [], defName: s.name, city: '', rounds: r.rounds }); continue; }
    const res = resolveDefense(s, c, p.att, p.prep, r, Math.max(p.t, s.t), env);
    w.putResult(id, { ...res, defName: s.name, city: c.name, wall: lv(c, 'wall') });
  }
}

// The computer sends an attack at a player's city.
function launchNpc(s, t, env) {
  const r = rng(hashStr(`${s.seed}:npc:${t}`));
  const next = () => { s.npcNext = t + scaled(s, NPC_ATTACK_EVERY[0] + r() * (NPC_ATTACK_EVERY[1] - NPC_ATTACK_EVERY[0])); };
  if (isProtected(s, t)) { s.npcNext = s.protectedUntil; return; }
  const c = s.cities[Math.floor(r() * s.cities.length)];
  const hostile = activeNpcs(s, env).filter((n) => !(s.pacts[n.clan] > t)).map((n) => ({ n, d: dist(n, c) })).sort((a, b) => a.d - b.d).slice(0, 4);
  if (!hostile.length) return next();
  const { n: npc, d } = hostile[Math.floor(r() * hostile.length)];
  const info = npcInfo(s, npc, t, env);
  const { side } = defenders(s, c, env);
  const dp = power(side, wallBonus(lv(c, 'wall'), s.techs.fortify).def);
  const floorP = 25 * lv(c, 'hall') ** 1.5;
  const want = Math.max(floorP, dp * (0.55 + r() * 0.6));
  const full = power(info.army) || 1;
  const k = Math.min(0.85, want / full);
  const groups = info.army.map((g) => ({ ...g, n: Math.max(0, Math.round(g.n * k)) })).filter((g) => g.n > 0);
  if (!groups.length) groups.push(barb('warrior', 3 * lv(c, 'hall')));
  const travel = Math.max(scaled(s, 120), Math.round(((d / (7 * WORLD_SPEED)) * HOUR) / s.speed));
  s.incoming.push({ id: s.seq++, kind: 'npc', npcId: npc.id, name: npc.name, city: c.id, groups, launched: t, arrive: t + travel });
  next();
}

function npcArrives(s, inc, env) {
  s.incoming.splice(s.incoming.indexOf(inc), 1);
  const c = cityOf(s, inc.city);
  const res = defendCity(s, c, { name: inc.name, groups: inc.groups, seed: `${s.seed}:inc:${inc.id}` }, inc.arrive, env);
  if (env?.world) {
    const before = inc.groups.reduce((a, g) => a + g.n, 0);
    const after = res.att.reduce((a, g) => a + g.n, 0);
    if (before) env.world.hitNpc(inc.npcId, { lost: ((before - after) / before) * 0.3, plunder: 0, t: inc.arrive });
  }
}

// An attack from another player (through the shared world).
function pvpArrives(s, inc, env) {
  const c = s.cities.find((x) => x.id === inc.toCity);
  env.world.removeIncoming(s.uid, inc.id);
  if (!c) { env.world.putResult(inc.id, { win: true, loot: {}, trapped: 0, att: inc.groups.map((g) => ({ key: g.key, n: g.n, lost: 0, dmg: 0 })), def: [], defName: s.name, city: '', rounds: 0 }); return; }
  const att = { name: inc.attName, groups: inc.groups, lootBoost: inc.lootBoost, crannyFactor: inc.crannyFactor, seed: `pvp:${inc.id}`, formation: inc.formation, canConquer: inc.canConquer };
  const prep = prepareDefense(s, c, att, inc.arrive, env);
  if (inc.tactical && prep.side.length) {
    // the attacker will lead the battle: keep the preparation and wait for the outcome
    (s.pendingDef ||= {})[inc.id] = { city: c.id, att, prep: { side: prep.side.map((g) => ({ key: g.key, stId: g.stId || null })), trapped: prep.trapped, night: prep.night }, t: inc.arrive };
    env.world.putResult(inc.id, { pending: true, battle: { seed: att.seed, att: prep.att, def: prep.side.map(({ stId, ...g }) => g), opts: prep.opts }, defName: s.name, city: c.name });
    return;
  }
  const res = resolveDefense(s, c, att, prep, autoBattle(att.seed, prep.att, prep.side, prep.opts), inc.arrive, env);
  env.world.putResult(inc.id, { ...res, defName: s.name, city: c.name, wall: lv(c, 'wall') });
}

// ---------- marches ----------
function marchSpeed(s, units, withHero) {
  let sp = Infinity;
  for (const [u, n] of Object.entries(units)) if (n > 0) sp = Math.min(sp, UNITS[u].speed);
  if (withHero) sp = Math.min(sp, heroStats(s).speed);
  return (sp === Infinity ? HERO.speed : sp) * WORLD_SPEED;
}

const travelTime = (s, from, to, units, withHero) => Math.max(scaled(s, 30), Math.round(((dist(from, to) / marchSpeed(s, units, withHero)) * HOUR) / s.speed));

function foundable(s, x, y, env) {
  if (tileAt(s.world, x, y).kind !== 'grass') return false;
  if (s.cities.some((c) => c.x === x && c.y === y)) return false;
  if (npcs(s).some((n) => n.x === x && n.y === y)) return false;
  if (s.camps.some((c) => c.x === x && c.y === y)) return false;
  if (env?.world?.cityAt(x, y)) return false;
  return true;
}

/**
 * Sends troops. kind: raid | attack | scout | support | found | adventure.
 * target: { type: camp|oasis|npc|player|city|ally|tile|adventure, id, x, y, uid, cityId, name, diff }.
 */
function send(s, t, cid, kind, target, units, withHero, env, tactical = false) {
  advance(s, t, env);
  if (!['raid', 'attack', 'scout', 'support', 'found', 'adventure'].includes(kind)) fail(tk('Unknown march.'));
  target = normalizeTarget(s, target || {}, env);
  const c = cityOf(s, cid);
  withHero = !!withHero;
  const sent = {};
  if (units && typeof units !== 'object') fail(tk('Invalid data.'));
  for (const [u, n] of Object.entries(units || {})) {
    const k = Math.floor(Number(n));
    if (!own(UNITS, u) || !(k > 0)) continue;
    if ((c.units[u] || 0) < k) fail(tk('You don\'t have that many troops in this city.'));
    sent[u] = k;
  }
  if (withHero) {
    if (!heroHome(s, c)) fail(tk('The hero is not in this city.'));
    if (s.hero.health < 10 && kind !== 'support') fail(tk('The hero is too badly wounded.'));
  }
  const fighters = Object.keys(sent).filter((u) => FIGHTERS.includes(u));
  const has = (u) => sent[u] > 0;
  if (kind === 'adventure') {
    if (!withHero || Object.keys(sent).length) fail(tk('Only the hero goes on an adventure.'));
    if (!s.adventures.some((a) => a.id === target.id)) fail(tk('The adventure is gone.'));
  } else if (kind === 'scout') {
    if (!has('scout') || Object.keys(sent).length > 1 || withHero) fail(tk('Send only scouts.'));
  } else if (kind === 'found') {
    if (!has('settler')) fail(tk('Settlers are required.'));
    if (s.cities.length >= allowedCities(s)) fail(tk('A new city requires Citadel level {0}.', 5 * s.cities.length));
    if (!foundable(s, target.x, target.y, env)) fail(tk('A city cannot be founded here.'));
  } else if (kind === 'support') {
    if (!fighters.length && !withHero) fail(tk('Choose troops.'));
    if (has('settler')) fail(tk('Settlers cannot reinforce.'));
  } else {
    if (!fighters.length && !withHero) fail(tk('Choose troops.'));
    if (has('settler') || has('scout')) fail(tk('Scouts and settlers do not fight.'));
  }
  if (kind === 'raid') {
    const camp = s.camps.find((x) => x.id === target.id);
    if (!camp) fail(tk('No such camp.'));
    if (camp.respawn) fail(tk('The camp is destroyed – the barbarians are still gathering.'));
    if (s.marches.some((m) => m.kind === 'raid' && m.target.id === camp.id && m.phase === 'go')) fail(tk('There is already a march to this camp.'));
  }
  if (kind === 'attack' && target.type === 'oasis') {
    const o = oasisInfo(s, target.x, target.y, env);
    if (!o) fail(tk('There is no oasis here.'));
    if (o.owner) fail(o.mine ? tk('The oasis is already yours.') : tk('The oasis is held by another player.'));
  }
  if (kind === 'attack' && target.type === 'player') {
    if (!env?.world) fail(tk('No connection to the world.'));
    const rel = env.world.relation(s.uid, target.uid);
    if (rel === 'alliance' || rel === 'ally' || rel === 'pact') fail(tk('You cannot attack allies.'));
    const p = env.world.player(target.uid);
    if (!p) fail(tk('No such player.'));
    if (p.protectedUntil > t) fail(tk('The player is under beginner protection.'));
  }
  if (kind === 'attack' && target.type === 'npc') {
    const npc = npcs(s).find((n) => n.id === target.id);
    if (!npc) fail(tk('No such ruler.'));
    if (s.pacts[npc.clan] > t) fail(tk('You have a pact with this clan.'));
  }
  if (kind === 'support' && target.type === 'ally' && env?.world?.relation(s.uid, target.uid) !== 'alliance') fail(tk('Reinforcements can only be sent to alliance members.'));
  if (kind === 'attack' && (target.type === 'npc' || target.type === 'player')) endProtection(s, t);
  for (const [u, n] of Object.entries(sent)) c.units[u] -= n;
  if (withHero) s.hero.state = 'away';
  const travel = travelTime(s, c, target, sent, withHero);
  const m = { id: s.seq++, kind, from: c.id, target, units: sent, hero: !!withHero, phase: 'go', depart: t, arrive: t + travel, travel, tactical: !!tactical && (kind === 'raid' || kind === 'attack') };
  s.marches.push(m);
  if (kind === 'adventure') s.adventures = s.adventures.filter((a) => a.id !== target.id);
  if (kind === 'attack' && target.type === 'player') {
    const mo = morale(score(s), env.world.player(target.uid)?.score || 0);
    const off = withHero ? heroStats(s).off : 0;
    const groups = Object.entries(sent).map(([u, n]) => { const st = unitStats(s, u, c); return { key: u, n, ...st, atk: st.atk * mo * (1 + off) }; });
    if (withHero) groups.push(heroGroup(s));
    m.pvpId = `${s.uid}:${m.id}`;
    m.morale = mo;
    env.world.sendIncoming({
      id: m.pvpId, toUid: target.uid, toCity: target.cityId, attUid: s.uid, attName: s.name, attRace: s.race,
      groups, lootBoost: s.race === 'orcs' ? 1.25 : 1, crannyFactor: s.race === 'orcs' ? 0.8 : 1, arrive: m.arrive, launched: t,
      tactical: m.tactical, formation: c.formation || null, canConquer: s.cities.length < allowedCities(s),
    });
  }
  return m;
}

// The target is taken from the game data (the client's coordinates are not trusted).
function normalizeTarget(s, T, env) {
  const xy = (o) => ({ x: o.x, y: o.y });
  switch (T.type) {
    case 'camp': { const c = s.camps.find((x) => x.id === T.id); if (!c) fail(tk('No such camp.')); return { type: 'camp', id: c.id, ...xy(c), name: campName(c) }; }
    case 'npc': { const n = activeNpcs(s, env).find((x) => x.id === T.id); if (!n) fail(tk('No such ruler (maybe already conquered).')); return { type: 'npc', id: n.id, ...xy(n), name: n.name }; }
    case 'player':
    case 'ally': {
      const p = env?.world?.player(T.uid);
      const pc = p?.cities.find((c) => c.id === T.cityId);
      if (!pc) fail(tk('No such city.'));
      return { type: T.type, uid: p.uid, cityId: pc.id, ...xy(pc), name: T.type === 'ally' ? p.name : `${p.name} – ${pc.name}` };
    }
    case 'city': { const c = s.cities.find((x) => x.id === T.id); if (!c) fail(tk('No such city.')); return { type: 'city', id: c.id, ...xy(c), name: c.name }; }
    case 'oasis': { const x = Math.round(+T.x), y = Math.round(+T.y); if (tileAt(s.world, x, y).kind !== 'oasis') fail(tk('There is no oasis here.')); return { type: 'oasis', x, y, name: tk('oasis ({0}|{1})', x, y) }; }
    case 'adventure': { const a = s.adventures.find((x) => x.id === T.id); if (!a) fail(tk('The adventure is gone.')); return { type: 'adventure', id: a.id, ...xy(a), diff: a.diff, name: tk('adventure') }; }
    case 'tile': { const x = Math.round(+T.x), y = Math.round(+T.y); if (!inWorld(x, y)) fail(tk('Outside the world.')); return { type: 'tile', x, y, name: String(T.name || '').trim().slice(0, 24) || undefined }; }
    default: fail(tk('Unknown target.'));
  }
}

// The army with its bonuses (incl. the hero and morale) for a march.
function attackSide(s, m, mo = 1) {
  const c = cityOf(s, m.from);
  const off = m.hero ? heroStats(s).off : 0;
  const side = FIGHTERS.filter((u) => m.units[u] > 0).map((u) => { const st = unitStats(s, u, c); return { key: u, n: m.units[u], ...st, atk: st.atk * mo * (1 + off) }; });
  if (m.hero && s.hero.state !== 'dead') side.push(heroGroup(s));
  return side;
}

function takeLoot(s, pile, survivors) {
  const room = Object.entries(survivors).reduce((a, [u, n]) => a + n * (UNITS[u]?.carry || 0), 0);
  const boost = s.race === 'orcs' ? 1.25 : 1;
  const total = sum(pile) * boost;
  const share = total ? Math.min(1, room / total) : 0;
  return Object.fromEntries(Object.entries(pile).map(([k, v]) => [k, Math.floor(v * boost * share)]));
}

const battleXp = (r) => r.def.reduce((a, g) => a + g.lost * ((UNITS[g.key]?.hp || 10) / 4), 0);

function arrive(s, m, env) {
  const t = m.arrive;
  const T = m.target;
  const survivorsOf = (r) => Object.fromEntries(r.att.filter((g) => g.n > 0 && g.key !== 'hero').map((g) => [g.key, g.n]));
  const finishBattle = (r) => {
    if (m.hero) {
      heroWounds(s, t, r.att.find((g) => g.key === 'hero'));
      if (s.hero.state !== 'dead') heroXp(s, t, battleXp(r));
    }
  };
  const goHome = (units, loot = {}) => {
    const heroBack = m.hero && s.hero.state !== 'dead';
    if (!Object.keys(units).length && !heroBack) { s.marches.splice(s.marches.indexOf(m), 1); return; }
    Object.assign(m, { phase: 'back', units, loot, hero: heroBack, back: t + m.travel });
  };

  if (m.kind === 'adventure') return adventureArrives(s, m, goHome);

  if (m.kind === 'raid' || (m.kind === 'attack' && (T.type === 'oasis' || T.type === 'npc'))) {
    const setup = battleSetup(s, m, env);
    if (!setup) {
      report(s, { kind: 'attack', t, title: tk('The oasis is already taken'), win: false, att: [], def: [] });
      return goHome(m.units);
    }
    if (m.tactical && setup.def.length) {
      m.phase = 'battle';
      m.battle = { seed: `${s.seed}:${m.id}`, ...setup, expires: t + scaled(s, TACTIC.window) };
      log(s, t, tk('The army has reached {0} – lead the battle!', T.name || tk('the target')), 'alarm');
      return;
    }
    const r = setup.def.length ? fight(setup.att, setup.def, `${s.seed}:${m.id}`, setup.opts) : emptyWin(setup.att);
    return conclude(s, m, env, setup, r, t);
  }

  if (m.kind === 'attack' && T.type === 'player') return tryPvpResult(s, m, env, true);

  if (m.kind === 'scout') return scoutArrives(s, m, env, goHome);

  if (m.kind === 'support') {
    if (T.type === 'city') {
      const to = cityOf(s, T.id);
      for (const [u, n] of Object.entries(m.units)) to.units[u] = (to.units[u] || 0) + n;
      if (m.hero) { s.hero.city = to.id; s.hero.state = 'home'; }
      log(s, t, tk('The reinforcements arrived in {0}.', to.name), 'march');
      s.marches.splice(s.marches.indexOf(m), 1);
      return;
    }
    const from = cityOf(s, m.from);
    const groups = Object.entries(m.units).map(([u, n]) => ({ key: u, n, ...unitStats(s, u, from) }));
    const id = `${s.uid}:${m.id}`;
    env?.world?.addStationed({ id, fromUid: s.uid, fromName: s.name, fromRace: s.race, fromCity: m.from, toUid: T.uid, toCity: T.cityId, toName: T.name, groups, since: t });
    s.abroad.push({ id, from: m.from, toUid: T.uid, toCity: T.cityId, toName: T.name, x: T.x, y: T.y, units: m.units });
    log(s, t, tk('The reinforcements arrived at {0}.', T.name), 'march');
    s.marches.splice(s.marches.indexOf(m), 1);
    return;
  }

  if (m.kind === 'found') {
    if (!foundable(s, T.x, T.y, env) || s.cities.length >= allowedCities(s)) {
      log(s, t, tk('The site for the new city is taken – the settlers are returning.'), 'loss');
      return goHome(m.units);
    }
    const id = `c${s.seq++}`;
    const name = T.name || tk('City {0}', s.cities.length + 1);
    const city = newCity(id, name, T.x, T.y, { gold: 400, wood: 600, stone: 500, food: 600 });
    const rest = { ...m.units };
    rest.settler--;
    if (!rest.settler) delete rest.settler;
    city.units = rest;
    s.cities.push(city);
    if (m.hero) { s.hero.city = id; s.hero.state = 'home'; }
    report(s, { kind: 'found', t, title: tk('City founded: {0} ({1}|{2})', name, T.x, T.y), win: true });
    log(s, t, tk('You founded a new city: {0}!', name), 'epoch');
    s.marches.splice(s.marches.indexOf(m), 1);
  }
}

const emptyWin = (att) => ({ win: 'att', rounds: 0, att: att.map((g) => ({ key: g.key, n: g.n, lost: 0, dmg: 0 })), def: [] });

function sendHome(s, m, t, units, loot = {}) {
  const heroBack = m.hero && s.hero.state !== 'dead';
  const i = s.marches.indexOf(m);
  if (!Object.keys(units).length && !heroBack) { if (i >= 0) s.marches.splice(i, 1); return; }
  Object.assign(m, { phase: 'back', units, loot, hero: heroBack, back: t + m.travel, battle: undefined });
}

// The sides of the battle on arrival (and everything needed after it).
function battleSetup(s, m, env) {
  const t = m.arrive, T = m.target;
  if (m.kind === 'raid') {
    const camp = s.camps.find((x) => x.id === T.id);
    return { type: 'camp', att: attackSide(s, m), def: campArmy(camp.lvl), opts: {}, ctx: { id: camp.id, lvl: camp.lvl, name: campName(camp) } };
  }
  if (T.type === 'oasis') {
    const o = oasisInfo(s, T.x, T.y, env);
    if (!o || o.owner) return null;
    return { type: 'oasis', att: attackSide(s, m), def: o.guards, opts: {}, ctx: { key: o.key, x: o.x, y: o.y, res: o.res, lvl: o.lvl, guarded: o.guards.length > 0 } };
  }
  const npc = npcs(s).find((n) => n.id === T.id);
  const info = npcInfo(s, npc, t, env);
  const mo = morale(score(s), info.score);
  const wb = wallBonus(info.wall);
  const night = isNight(t) ? NIGHT.bonus : 1;
  return { type: 'npc', att: attackSide(s, m, mo), def: info.army, opts: { defMult: wb.def * night, defHp: wb.hp, formA: cityOf(s, m.from).formation || null }, ctx: { id: npc.id, name: npc.name, pile: info.pile, lost: info.lost, wall: info.wall, morale: mo, night: night > 1, loyalty: info.loyalty, lvl: info.lvl } };
}

// Consequences of a battle (raid, oasis, computer ruler).
function conclude(s, m, env, setup, r, t) {
  const ctx = setup.ctx;
  if (m.hero) {
    heroWounds(s, t, r.att.find((g) => g.key === 'hero'));
    if (s.hero.state !== 'dead') heroXp(s, t, battleXp(r));
  }
  const win = r.win === 'att';
  const surv = Object.fromEntries(r.att.filter((g) => g.n > 0 && g.key !== 'hero').map((g) => [g.key, g.n]));
  if (r.tactical && win) bump(s, t, 'tactics');
  const tag = r.tactical ? tk(' (tactical battle)') : '';
  if (setup.type === 'camp') {
    const camp = s.camps.find((x) => x.id === ctx.id);
    let raised = 0, loot = {};
    if (win && s.race === 'undead') {
      raised = Math.floor(r.def.reduce((a, g) => a + g.lost, 0) * 0.1);
      if (raised) surv.warrior = (surv.warrior || 0) + raised;
    }
    if (win) {
      const pile = campLoot(ctx.lvl);
      const souls = pile.souls;
      delete pile.souls;
      loot = takeLoot(s, pile, surv);
      if (souls) loot.souls = souls;
      s.stats.bestCamp = Math.max(s.stats.bestCamp, ctx.lvl);
      bump(s, t, 'raids');
      if (camp) camp.respawn = t + scaled(s, CAMP_RESPAWN);
    }
    report(s, { kind: 'raid', t, title: tk('{0}: {1} (level {2}){3}', win ? tk('Victory') : tk('Defeat'), ctx.name, ctx.lvl, tag), win, att: r.att, def: r.def, loot, raised, rounds: r.rounds });
    log(s, t, win ? tk('Victory over {0} (level {1})!', ctx.name, ctx.lvl) : tk('Defeat at {0} (level {1}).', ctx.name, ctx.lvl), win ? 'win' : 'loss');
    return sendHome(s, m, t, surv, loot);
  }
  if (setup.type === 'oasis') {
    const g = (s.guards[ctx.key] ||= { alive: 1, respawn: 0 });
    let loot = {}, annexed = false, note = '';
    if (win) {
      if (ctx.guarded) {
        g.alive = 0;
        g.respawn = t + scaled(s, OASIS_RESPAWN);
        const pile = campLoot(ctx.lvl);
        delete pile.souls;
        for (const k of Object.keys(pile)) pile[k] = Math.round(pile[k] * (k === ctx.res ? 1 : 0.4));
        loot = takeLoot(s, pile, surv);
        bump(s, t, 'raids');
      }
      const from = cityOf(s, m.from);
      const heroOk = m.hero && s.hero.state !== 'dead';
      if (!heroOk) note = tk('To conquer the oasis, send the hero as well.');
      else if (s.oases.length >= oasisSlots(s)) note = tk('You have no free oasis slot – upgrade the Hall of Heroes (level 3, 6, 10).');
      else if (dist(from, ctx) > OASIS_RANGE + 0.01) note = tk('The oasis is more than {0} tiles from {1}.', OASIS_RANGE, from.name);
      else if (env?.world?.oasisOwner(ctx.key)) note = tk('Another ruler conquered it before you.');
      else {
        s.oases.push({ key: ctx.key, x: ctx.x, y: ctx.y, res: ctx.res, city: from.id });
        env?.world?.setOasisOwner(ctx.key, s.uid, s.name);
        annexed = true;
        log(s, t, tk('The oasis ({0}|{1}) is yours: +25% {2} for {3}.', ctx.x, ctx.y, resName(s.race, ctx.res).toLowerCase(), from.name), 'win');
      }
    } else {
      const before = setup.def.reduce((a, x) => a + x.n, 0);
      const after = r.def.reduce((a, x) => a + x.n, 0);
      g.alive = before ? (g.alive * after) / before : g.alive;
    }
    report(s, { kind: 'attack', t, title: tk('{0}: oasis ({1}|{2}){3}', win ? tk('Victory') : tk('Defeat'), ctx.x, ctx.y, tag), win, att: r.att, def: r.def, loot, annexed, rounds: r.rounds, note });
    return sendHome(s, m, t, surv, loot);
  }
  const loot = win ? takeLoot(s, ctx.pile, surv) : {};
  const before = setup.def.reduce((a, g) => a + g.n, 0) || 1;
  const killed = r.def.reduce((a, g) => a + g.lost, 0);
  const siege = {};
  let conquered = false;
  if (win) {
    const cats = r.att.find((g) => g.key === 'catapult')?.n || 0;
    if (cats) siege.wall = Math.min(ctx.wall, Math.floor(cats / 6));
    const nobles = r.att.find((g) => g.key === 'noble')?.n || 0;
    if (nobles) {
      const rr = rng(hashStr(`${s.seed}:${m.id}:noble`));
      let drop = 0;
      for (let i = 0; i < Math.min(3, nobles); i++) drop += 20 + Math.floor(rr() * 11);
      const loy = (ctx.loyalty ?? 100) - drop;
      siege.loyalty = Math.max(0, Math.round(loy));
      if (loy <= 0 && s.cities.length < allowedCities(s)) conquered = true;
      else if (loy <= 0) siege.note = tk('You have no room for a new city – upgrade the Citadel.');
    }
  }
  env?.world?.hitNpc(ctx.id, {
    lost: (killed / before) * (1 - ctx.lost), plunder: win ? sum(loot) / (sum(ctx.pile) || 1) : 0, t,
    wallDmg: siege.wall || 0, loyalty: siege.loyalty != null ? Math.max(1, siege.loyalty) : undefined,
    owner: conquered ? { uid: s.uid, name: s.name } : undefined,
  });
  if (conquered) {
    const L = Math.floor(ctx.lvl);
    const lvl = (k) => Math.max(1, Math.min(EPOCHS[s.epoch - 1].cap, Math.floor(L * k)));
    addCapturedCity(s, t, {
      name: ctx.name, x: m.target.x, y: m.target.y, res: { gold: 500, wood: 800, stone: 700, food: 800 },
      b: { hall: lvl(0.5), farm: lvl(0.5), lumber: lvl(0.5), quarry: lvl(0.45), mine: lvl(0.4), houses: lvl(0.45), warehouse: lvl(0.45), barracks: lvl(0.35), wall: lvl(0.3) },
    });
    if (surv.noble) { surv.noble--; if (!surv.noble) delete surv.noble; }
  }
  if (win) bump(s, t, 'raids');
  report(s, { kind: 'attack', t, title: `${conquered ? tk('Conquered') : win ? tk('Victory') : tk('Defeat')}: ${ctx.name}${tag}`, win, att: r.att, def: r.def, loot, morale: ctx.morale, night: ctx.night, wall: ctx.wall, rounds: r.rounds, siege });
  log(s, t, win ? tk('You plundered {0}!', ctx.name) : tk('The attack on {0} failed.', ctx.name), win ? 'win' : 'loss');
  return sendHome(s, m, t, surv, loot);
}

// The player fought the tactical battle: the server replays their moves.
function fightTactical(s, t, marchId, moves, env) {
  advance(s, t, env);
  const m = s.marches.find((x) => x.id === marchId && x.phase === 'battle');
  if (!m) fail(tk('The battle is already decided.'));
  if (moves != null && !Array.isArray(moves)) fail(tk('Invalid moves.'));
  finishBattleAt(s, m, env, replay(m.battle, moves || []), t);
}

// Outcome of a tactical battle: against the computer – immediately; against a player – through the defender.
function finishBattleAt(s, m, env, r, t) {
  if (m.battle.pvp) {
    env?.world?.putOutcome(m.pvpId, r);
    m.phase = 'wait';
    m.battle = undefined;
    m.arrive = t;
    if (r.win === 'att') bump(s, t, 'tactics');
    tryPvpResult(s, m, env);
    return;
  }
  conclude(s, m, env, m.battle, r, t);
}

function tryPvpResult(s, m, env, atArrival = false) {
  const w = env?.world;
  let res = w?.result(m.pvpId);
  if (!res && w?.resolveOffline) { w.resolveOffline(m.target.uid, m.pvpId, m.arrive); res = w.result(m.pvpId); }
  if (!res) { if (atArrival) m.phase = 'wait'; return; }
  w.clearResult(m.pvpId);
  const t = m.arrive;
  if (res.pending) {
    // the defender is ready – we fight the battle ourselves
    m.phase = 'battle';
    m.battle = { ...res.battle, pvp: true, expires: Math.max(t, s.t) + scaled(s, TACTIC.window) };
    log(s, s.t, tk('The army has reached {0} – lead the battle!', res.defName), 'alarm');
    return;
  }
  const win = res.win;
  if (m.hero) {
    heroWounds(s, t, res.att.find((g) => g.key === 'hero'));
    if (s.hero.state !== 'dead') heroXp(s, t, battleXp(res));
  }
  const surv = Object.fromEntries(res.att.filter((g) => g.n > 0 && g.key !== 'hero').map((g) => [g.key, g.n]));
  if (win) bump(s, t, 'raids');
  if (res.captured) {
    if (s.cities.length < allowedCities(s)) {
      addCapturedCity(s, t, res.captured);
      if (surv.noble) { surv.noble--; if (!surv.noble) delete surv.noble; }
    }
  }
  report(s, { kind: 'attack', t, title: `${res.captured ? tk('Conquered') : win ? tk('Victory') : tk('Defeat')}: ${res.defName} – ${res.city}`, win, att: res.att, def: res.def, loot: res.loot, trapped: res.trapped, wall: res.wall, rounds: res.rounds, morale: m.morale, siege: res.siege });
  log(s, t, win ? tk('You plundered {0}!', res.defName) : tk('The attack on {0} failed.', res.defName), win ? 'win' : 'loss');
  const heroBack = m.hero && s.hero.state !== 'dead';
  if (!Object.keys(surv).length && !heroBack) { s.marches.splice(s.marches.indexOf(m), 1); return; }
  Object.assign(m, { phase: 'back', units: surv, loot: res.loot, hero: heroBack, back: t + m.travel });
}

const intelKey = (T) => `${T.type}:${T.type === 'player' ? `${T.uid}:${T.cityId}` : T.id ?? `${T.x}|${T.y}`}`;

function scoutArrives(s, m, env, goHome) {
  const t = m.arrive;
  const T = m.target;
  const A = m.units.scout;
  let D = 0, data = null, title = '';
  if (T.type === 'npc') {
    const info = npcInfo(s, npcs(s).find((n) => n.id === T.id), t, env);
    D = info.scouts;
    data = { army: info.army.map((g) => ({ key: g.key, n: g.n })), wall: info.wall, pile: info.pile, lvl: info.lvl, loyalty: Math.round(info.loyalty) };
    title = info.name;
  } else if (T.type === 'player') {
    const p = env?.world?.player(T.uid);
    const pc = p?.cities.find((c) => c.id === T.cityId);
    D = pc?.scouts || 0;
    data = pc ? { army: Object.entries(pc.units || {}).map(([key, n]) => ({ key, n })), wall: pc.wall, traps: pc.traps, cranny: pc.cranny, res: pc.res, race: p.race, loyalty: pc.loyalty } : null;
    title = `${p?.name || tk('Player')} – ${pc?.name || ''}`;
  } else if (T.type === 'oasis') {
    const o = oasisInfo(s, T.x, T.y, env);
    data = { army: (o?.guards || []).map((g) => ({ key: g.key, n: g.n })), res: o?.res };
    title = tk('Oasis ({0}|{1})', T.x, T.y);
  } else if (T.type === 'camp') {
    const camp = s.camps.find((x) => x.id === T.id);
    data = { army: campArmy(camp.lvl).map((g) => ({ key: g.key, n: g.n })) };
    title = campName(camp);
  }
  const ok = s.race === 'vesheri' || A >= D * 0.8;
  const lost = ok ? Math.min(A, Math.floor(A * Math.min(0.5, D / (A * 2 || 1)))) : A;
  if (ok) {
    s.intel[intelKey(T)] = { t, data, title };
    bump(s, t, 'scouted');
  }
  report(s, { kind: 'scout', t, title: `${ok ? tk('Scouting') : tk('The scouts were discovered')}: ${title}`, win: ok, intel: ok ? data : null, scoutsLost: lost });
  log(s, t, ok ? tk('The scouts scouted {0}.', title) : tk('The scouts at {0} were killed.', title), ok ? 'info' : 'loss');
  const left = A - lost;
  goHome(left > 0 ? { scout: left } : {});
}

function comeBack(s, m) {
  s.marches.splice(s.marches.indexOf(m), 1);
  const c = cityOf(s, m.from);
  for (const [u, n] of Object.entries(m.units)) c.units[u] = (c.units[u] || 0) + n;
  if (m.hero && s.hero.state !== 'dead') { s.hero.state = 'home'; s.hero.city = c.id; }
  addRes(c, m.loot || {}, true);
  log(s, m.back, m.kind === 'adventure' ? tk('{0} returned from an adventure.', s.hero.name) : tk('The army returned to {0}.', c.name), 'march');
}

// Withdrawing reinforcements from an ally.
function recall(s, t, abroadId, env) {
  advance(s, t, env);
  const i = s.abroad.findIndex((a) => a.id === abroadId);
  if (i < 0) fail(tk('No such reinforcements.'));
  const [a] = s.abroad.splice(i, 1);
  const st = env?.world?.removeStationed(a.id);
  const units = st ? Object.fromEntries(st.groups.filter((g) => g.n > 0).map((g) => [g.key, g.n])) : a.units;
  if (!Object.keys(units).length) return;
  const from = cityOf(s, a.from);
  const travel = travelTime(s, { x: a.x, y: a.y }, from, units, false);
  s.marches.push({ id: s.seq++, kind: 'support', from: a.from, target: { type: 'ally', name: a.toName, x: a.x, y: a.y }, units, hero: false, phase: 'back', depart: t, arrive: t, back: t + travel, travel, loot: {} });
}

// An ally's reinforcements return by themselves if the ally sends them away (or leaves the alliance).
function syncAbroad(s, t, env) {
  if (!env?.world) return;
  for (const a of [...s.abroad]) {
    const st = env.world.stationedById(a.id);
    if (!st) {
      s.abroad.splice(s.abroad.indexOf(a), 1);
      continue;
    }
    a.units = Object.fromEntries(st.groups.filter((g) => g.n > 0).map((g) => [g.key, g.n]));
    if (st.sendBack) recall(s, t, a.id, env);
  }
}

// ---------- adventures ----------
function spawnAdventure(s) {
  const t = s.advNext;
  s.advNext = t + scaled(s, ADVENTURE.every);
  if (s.adventures.length >= ADVENTURE.max) return;
  const r = rng(hashStr(`${s.seed}:adv:${t}`));
  const c = s.cities[Math.floor(r() * s.cities.length)];
  for (let k = 0; k < 12; k++) {
    const ang = r() * Math.PI * 2, rad = 2 + r() * 5;
    const x = Math.round(c.x + Math.cos(ang) * rad), y = Math.round(c.y + Math.sin(ang) * rad);
    const tile = tileAt(s.world, x, y);
    if (tile.kind === 'void' || tile.kind === 'lake' || tile.kind === 'oasis') continue;
    if (s.adventures.some((a) => a.x === x && a.y === y) || s.cities.some((cc) => cc.x === x && cc.y === y)) continue;
    s.adventures.push({ id: s.seq++, x, y, diff: r() < 0.3 ? 'hard' : 'normal', expires: t + scaled(s, ADVENTURE.life) });
    return;
  }
}

function adventureArrives(s, m, goHome) {
  const t = m.arrive;
  const hard = m.target.diff === 'hard';
  const r = rng(hashStr(`${s.seed}:advres:${m.id}`));
  const h = s.hero;
  const red = Math.min(0.6, heroStats(s).armorRed + h.lvl * 0.015);
  const dmg = (hard ? 18 + r() * 24 : 8 + r() * 14) * (1 - red);
  let text;
  const reward = {};
  let item = null, units = 0;
  bump(s, t, 'adventures');
  if (h.health - dmg <= 0 && hard) {
    h.health = 0;
    h.state = 'dead';
    text = tk('{0} died on a dangerous adventure.', h.name);
  } else {
    h.health = Math.max(1, h.health - dmg);
    heroXp(s, t, (hard ? 2.2 : 1) * (15 + r() * 15) * (1 + h.lvl * 0.15));
    const roll = r();
    if (roll < (hard ? 0.4 : 0.22)) {
      const tr = r();
      const tier = hard ? (tr < 0.35 ? 1 : tr < 0.75 ? 2 : tr < 0.95 ? 3 : 4) : (tr < 0.7 ? 1 : tr < 0.95 ? 2 : 3);
      const slots = Object.keys(ITEM_FX);
      item = { id: s.seq++, slot: slots[Math.floor(r() * slots.length)], tier };
      h.items.push(item);
      text = tk('{0} found an item: {1}.', h.name, itemOf(item).name);
    } else if (roll < 0.55) {
      const amount = Math.round(250 * (1 + h.lvl * 0.4) * (hard ? 2 : 1));
      const ks = ['gold', 'wood', 'stone', 'food'];
      const a = ks[Math.floor(r() * 4)], b = ks[Math.floor(r() * 4)];
      reward[a] = (reward[a] || 0) + amount;
      reward[b] = (reward[b] || 0) + Math.round(amount / 2);
      text = tk('{0} found hidden supplies.', h.name);
    } else if (roll < 0.72) {
      reward.souls = 2 + Math.floor(r() * (hard ? 8 : 4));
      text = tk('{0} gathered souls from an ancient battlefield.', h.name);
    } else if (roll < 0.85) {
      units = 3 + Math.floor(r() * (hard ? 10 : 5));
      text = tk('{0} fighters joined the hero.', units);
    } else {
      reward.gold = Math.round(150 * (1 + h.lvl * 0.3));
      text = tk('{0} helped travellers and received gold.', h.name);
    }
  }
  report(s, { kind: 'adventure', t, title: tk('Adventure ({0})', hard ? tk('dangerous') : tk('ordinary')), win: h.state !== 'dead', text, loot: reward, item: item ? itemOf(item) : null, dmg: Math.round(dmg) });
  log(s, t, text, h.state === 'dead' ? 'loss' : 'win');
  goHome(units ? { warrior: units } : {}, reward);
}

// A snapshot of the empire for the shared world (map, rankings, scouting by other players).
function snapshot(s, alliance = null) {
  return {
    uid: s.uid, name: s.name, race: s.race, epoch: s.epoch, score: score(s), protectedUntil: s.protectedUntil, alliance, t: s.t,
    cities: s.cities.map((c) => ({
      id: c.id, name: c.name, x: c.x, y: c.y, hall: lv(c, 'hall'), loyalty: Math.round(c.loyalty ?? 100), burnT: c.burnT || 0, captured: !!c.captured, wall: lv(c, 'wall'), traps: lv(c, 'traps'), cranny: lv(c, 'cranny'),
      units: Object.fromEntries(FIGHTERS.filter((u) => c.units[u] > 0).map((u) => [u, c.units[u]])), scouts: c.units.scout || 0,
      res: Object.fromEntries(['gold', 'wood', 'stone', 'food'].map((k) => [k, Math.floor(c.res[k])])),
    })),
  };
}

// ---------- all player actions (the server goes through them too) ----------
const cleanName = (v, max) => { const n = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max); if (!n) fail(tk('Enter a name.')); return n; };
const ACTIONS = {
  build: (s, t, env, cid, id) => build(s, t, cid, id, env),
  cancelBuild: (s, t, env, cid, id) => cancelBuild(s, t, cid, id, env),
  train: (s, t, env, cid, u, n) => train(s, t, cid, u, n, env),
  research: (s, t, env, cid, id) => research(s, t, cid, id, env),
  advanceEpoch: (s, t, env, cid) => advanceEpoch(s, t, cid, env),
  claimStory: (s, t, env, cid, id) => claimStory(s, t, cid, id, env),
  claimDaily: (s, t, env, cid, id) => claimDaily(s, t, cid, id, env),
  send: (s, t, env, cid, kind, target, units, withHero, tactical) => { send(s, t, cid, kind, target, units, withHero, env, tactical); },
  recall: (s, t, env, id) => recall(s, t, id, env),
  revive: (s, t, env, cid) => reviveHero(s, t, cid, env),
  pact: (s, t, env, cid, clan) => buyPact(s, t, cid, clan, env),
  sellItem: (s, t, env, cid, id) => sellItem(s, t, cid, id),
  assignPoint: (s, t, env, key) => assignPoint(s, key),
  equip: (s, t, env, id) => equip(s, id),
  unequip: (s, t, env, slot) => unequip(s, slot),
  endProtection: (s, t) => endProtection(s, t),
  renameCity: (s, t, env, cid, name) => { const c = s.cities.find((x) => x.id === cid); if (!c) fail(tk('No such city.')); c.name = cleanName(name, 24); },
  renameHero: (s, t, env, name) => { s.hero.name = cleanName(name, 20); },
  tactical: (s, t, env, marchId, moves) => fightTactical(s, t, marchId, moves, env),
  setFormation: (s, t, env, cid, cls, pos) => {
    const c = s.cities.find((x) => x.id === cid);
    if (!c) fail(tk('No such city.'));
    if (!own(FORMATION, cls) || !['front', 'back', 'flank'].includes(pos)) fail(tk('Invalid formation.'));
    c.formation = { ...FORMATION, ...(c.formation || {}), [cls]: pos };
  },
};

function perform(s, t, env, name, args = []) {
  if (!own(ACTIONS, name)) fail(tk('Unknown action.'));
  if (!Array.isArray(args) || args.length > 8) fail(tk('Invalid data.'));
  advance(s, t, env);
  ACTIONS[name](s, t, env, ...args);
  return s;
}

return { newGame, migrate, cityOf, lv, maxLv, bName, bDesc, uName, bCost, bTime, maxLevel, bProd, storageCap, capOf, crannyCap, trapCap, wallBonus, warnWindow, oasisSlots, allowedCities, embassyMax, popCap, popUsed, upkeep, heroHome, rates, unitStats, uCost, uTime, tTime, canPay, itemOf, heroStats, assignPoint, equip, unequip, sellItem, reviveCost, reviveTime, reviveHero, advance, setSpeed, dayKey, dailyList, claimDaily, storyList, claimStory, buildSlots, buildState, build, cancelBuild, unitLock, maxTrain, train, techState, research, epochReqs, advanceEpoch, campMax, campName, campArmy, campLoot, oasisInfo, npcLevel, npcInfo, npcs, activeNpcs, isProtected, localHour, localMonth, isNight, score, morale, endProtection, pactCost, buyPact, defenders, marchSpeed, travelTime, foundable, send, fightTactical, intelKey, recall, syncAbroad, snapshot, perform };
})();

__m['js/games/empires/worldcore.js'] = (() => {
// Evil Empires – the shared world as a document: players, alliances, chat, reinforcements, oases,
// attacks between players. The same functions run in the browser (localStorage)
// and on the server (Supabase); there is no storage access here – only the document.
const { npcList, homeStart, findSpot, dist } = __m['js/games/empires/worldgen.js'];
const { tk } = __m['js/i18n/tk.js'];

function freshWorld(seed = (Math.random() * 2 ** 31) >>> 0, created = Date.now()) {
  return { v: 1, seed, created, players: {}, alliances: {}, incoming: {}, results: {}, stationed: [], oases: {}, npc: {} };
}

// A spot for a new player's capital.
function allocateHomeIn(w, uid) {
  if (w.players[uid]?.cities?.[0]) return { x: w.players[uid].cities[0].x, y: w.players[uid].cities[0].y, seed: w.seed };
  const npcs = npcList(w.seed);
  const taken = (x, y, gap) =>
    npcs.some((n) => dist(n, { x, y }) < gap + 3) ||
    Object.values(w.players).some((p) => p.cities.some((c) => dist(c, { x, y }) < gap + 2));
  const spot = findSpot(w.seed, homeStart(w.seed, uid), taken, 2) || { x: 0, y: 0 };
  return { ...spot, seed: w.seed };
}

// What a player sees of the world: without the resources and troops of others (those are learned by scouting).
function buildView(w, uid) {
  const me = w.players[uid];
  const myAlliance = me?.alliance;
  const players = {};
  for (const [id, p] of Object.entries(w.players)) {
    players[id] = id === uid ? p : {
      uid: p.uid, name: p.name, race: p.race, epoch: p.epoch, score: p.score, protectedUntil: p.protectedUntil, alliance: p.alliance, t: p.t,
      cities: p.cities.map((c) => ({ id: c.id, name: c.name, x: c.x, y: c.y, hall: c.hall, loyalty: c.loyalty, burnT: c.burnT, captured: c.captured })),
    };
  }
  const alliances = {};
  for (const [id, a] of Object.entries(w.alliances)) {
    alliances[id] = { ...a, chat: id === myAlliance ? a.chat : [], invites: a.invites.filter((x) => x === uid || id === myAlliance) };
  }
  const results = {};
  for (const [id, r] of Object.entries(w.results)) if (id.startsWith(`${uid}:`)) results[id] = r;
  // private messages: only the player's own conversations
  const dms = {};
  for (const [k, list] of Object.entries(w.dms || {})) if (k.split('|').includes(uid)) dms[k] = list;
  return {
    v: 1, seed: w.seed, created: w.created, players, alliances, results, dms, npc: w.npc, oases: w.oases,
    incoming: { [uid]: w.incoming[uid] || [] },
    stationed: w.stationed.filter((x) => x.toUid === uid || x.fromUid === uid),
  };
}

/**
 * The world interface used by the game logic (env.world) and the UI.
 * store: { get() → document, mutate(fn) → the result of fn(document) }.
 */
function makeWorld(store, uid) {
  const W = () => store.get();
  const mut = (fn) => store.mutate(fn);
  const fail = (msg) => { throw new Error(msg); };
  return {
    get seed() { return W().seed; },
    get created() { return W().created; },
    raw: W,

    // ----- players -----
    player: (id) => W().players[id] || null,
    players: () => Object.values(W().players),
    publish(snap) {
      mut((w) => {
        const old = w.players[snap.uid];
        w.players[snap.uid] = { ...snap, alliance: old?.alliance || null, joined: old?.joined || Date.now() };
      });
    },
    removePlayer(id) {
      mut((w) => {
        const aid = w.players[id]?.alliance;
        const a = w.alliances[aid];
        if (a) {
          a.members = a.members.filter((x) => x !== id);
          if (!a.members.length) delete w.alliances[aid];
          else if (a.leader === id) a.leader = a.members[0];
        }
        delete w.players[id];
        delete w.incoming[id];
        for (const k of Object.keys(w.dms || {})) if (k.split('|').includes(id)) delete w.dms[k];
        for (const [k, o] of Object.entries(w.oases)) if (o.uid === id) delete w.oases[k];
        for (const st of w.stationed) if (st.toUid === id || st.fromUid === id) st.sendBack = true;
      });
    },
    cityAt(x, y) {
      for (const p of Object.values(W().players)) for (const c of p.cities) if (c.x === x && c.y === y) return { ...c, uid: p.uid, owner: p.name, race: p.race };
      return null;
    },

    // ----- attacks between players -----
    incomingFor: (id) => W().incoming[id] || [],
    sendIncoming(rec) { mut((w) => { (w.incoming[rec.toUid] ||= []).push(rec); }); },
    removeIncoming(id, recId) { mut((w) => { w.incoming[id] = (w.incoming[id] || []).filter((x) => x.id !== recId); }); },
    putResult(id, res) { mut((w) => { w.results[id] = res; }); },
    result: (id) => W().results[id] || null,
    clearResult(id) { mut((w) => { delete w.results[id]; }); },
    // the outcome of a tactical battle against a player (the attacker sends it, the defender applies it)
    putOutcome(id, r) { mut((w) => { w.results[`o:${id}`] = r; }); },
    outcome: (id) => W().results[`o:${id}`] || null,
    clearOutcome(id) { mut((w) => { delete w.results[`o:${id}`]; }); },
    resolveOffline: null,

    // ----- reinforcements -----
    stationedAt: (toUid, cityId) => W().stationed.filter((x) => x.toUid === toUid && x.toCity === cityId),
    stationedFrom: (fromUid) => W().stationed.filter((x) => x.fromUid === fromUid),
    stationedById: (id) => W().stationed.find((x) => x.id === id) || null,
    addStationed(rec) { mut((w) => { w.stationed.push(rec); }); },
    setStationed(id, groups) {
      mut((w) => {
        const st = w.stationed.find((x) => x.id === id);
        if (st) st.groups = groups;
        w.stationed = w.stationed.filter((x) => x.groups.some((g) => g.n > 0));
      });
    },
    removeStationed(id) {
      return mut((w) => {
        const st = w.stationed.find((x) => x.id === id) || null;
        w.stationed = w.stationed.filter((x) => x.id !== id);
        return st;
      });
    },
    sendBackStationed(id) {
      mut((w) => {
        const st = w.stationed.find((x) => x.id === id);
        if (!st || (st.toUid !== uid && st.fromUid !== uid)) fail(tk('No such reinforcements.'));
        st.sendBack = true;
      });
    },

    // ----- computer empires -----
    npcState: (id) => W().npc[id] || null,
    hitNpc(id, { lost = 0, plunder = 0, t, wallDmg = 0, loyalty, owner }) {
      mut((w) => {
        const o = w.npc[id] || { lost: 0, lostT: t, plunder: 0, plunderT: t };
        if (lost) Object.assign(o, { lost: Math.min(0.9, o.lost + lost), lostT: t });
        if (plunder) Object.assign(o, { plunder: Math.min(0.9, o.plunder + plunder), plunderT: t });
        if (wallDmg) Object.assign(o, { wallDmg: (o.wallDmg || 0) + wallDmg, wallT: t });
        if (loyalty != null) Object.assign(o, { loyalty, loyT: t });
        if (owner) o.owner = owner;
        w.npc[id] = o;
      });
    },

    // ----- oases -----
    oasisOwner: (key) => W().oases[key] || null,
    setOasisOwner(key, ownerUid, name) { mut((w) => { if (ownerUid) w.oases[key] = { uid: ownerUid, name }; else delete w.oases[key]; }); },

    // ----- alliances -----
    allianceOf: (id) => { const a = W().players[id]?.alliance; return a ? W().alliances[a] || null : null; },
    alliances: () => Object.values(W().alliances),
    relation(a, b) {
      if (a === b) return 'self';
      const w = W();
      const pa = w.players[a]?.alliance, pb = w.players[b]?.alliance;
      if (!pa || !pb) return null;
      if (pa === pb) return 'alliance';
      return w.alliances[pa]?.diplomacy?.[pb] || null;
    },
    invitesFor: (id) => Object.values(W().alliances).filter((a) => a.invites.includes(id)),
    createAlliance(name, tag, embassy) {
      name = String(name || '').trim().slice(0, 28);
      tag = String(tag || '').trim().toUpperCase().slice(0, 4);
      if (name.length < 3 || tag.length < 2) fail(tk('Name (3+ letters) and tag (2–4 characters).'));
      if (embassy != null && embassy < 3) fail(tk('Embassy level 3 required.'));
      return mut((w) => {
        if (!w.players[uid]) fail(tk('Your empire is not in the world yet.'));
        if (w.players[uid].alliance) fail(tk('You are already in an alliance.'));
        if (Object.values(w.alliances).some((a) => a.tag.toLowerCase() === tag.toLowerCase())) fail(tk('This tag is taken.'));
        const id = 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
        w.alliances[id] = { id, name, tag, leader: uid, members: [uid], invites: [], chat: [], diplomacy: {}, created: Date.now() };
        w.players[uid].alliance = id;
        return id;
      });
    },
    invite(targetUid) {
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a) fail(tk('You are not in an alliance.'));
        if (!w.players[targetUid]) fail(tk('No such player.'));
        if (w.players[targetUid].alliance) fail(tk('The player is already in an alliance.'));
        if (!a.invites.includes(targetUid)) a.invites.push(targetUid);
      });
    },
    acceptInvite(aid, maxMembers) {
      mut((w) => {
        const a = w.alliances[aid];
        if (!a || !a.invites.includes(uid)) fail(tk('The invitation is no longer valid.'));
        if (w.players[uid]?.alliance) fail(tk('You are already in an alliance.'));
        if (a.members.length >= maxMembers) fail(tk('The alliance is full.'));
        a.invites = a.invites.filter((x) => x !== uid);
        a.members.push(uid);
        w.players[uid].alliance = aid;
        a.chat.push({ sys: true, text: tk('{0} joined the alliance.', w.players[uid].name), t: Date.now() });
      });
    },
    declineInvite(aid) { mut((w) => { const a = w.alliances[aid]; if (a) a.invites = a.invites.filter((x) => x !== uid); }); },
    leave() {
      mut((w) => {
        const aid = w.players[uid]?.alliance;
        const a = w.alliances[aid];
        if (!a) return;
        a.members = a.members.filter((x) => x !== uid);
        w.players[uid].alliance = null;
        a.chat.push({ sys: true, text: tk('{0} left the alliance.', w.players[uid].name), t: Date.now() });
        for (const st of w.stationed) if ((st.fromUid === uid && a.members.includes(st.toUid)) || (st.toUid === uid && a.members.includes(st.fromUid))) st.sendBack = true;
        if (!a.members.length) delete w.alliances[aid];
        else if (a.leader === uid) a.leader = a.members[0];
      });
    },
    kick(targetUid) {
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a || a.leader !== uid) fail(tk('Only the leader can kick members.'));
        if (targetUid === uid || !a.members.includes(targetUid)) fail(tk('No such member.'));
        a.members = a.members.filter((x) => x !== targetUid);
        if (w.players[targetUid]) w.players[targetUid].alliance = null;
        a.chat.push({ sys: true, text: tk('{0} was kicked.', w.players[targetUid]?.name || tk('Player')), t: Date.now() });
        for (const st of w.stationed) if ((st.fromUid === targetUid && a.members.includes(st.toUid)) || (st.toUid === targetUid && a.members.includes(st.fromUid))) st.sendBack = true;
      });
    },
    setRelation(otherId, rel) {
      if (rel && !['ally', 'pact', 'war'].includes(rel)) fail(tk('Invalid relation.'));
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a || a.leader !== uid) fail(tk('Only the leader sets the diplomacy.'));
        const o = w.alliances[otherId];
        if (!o || o.id === a.id) fail(tk('No such alliance.'));
        if (rel) a.diplomacy[otherId] = rel; else delete a.diplomacy[otherId];
        // alliance and pact are mutual; war is one-sided
        if (rel === 'ally' || rel === 'pact') o.diplomacy[a.id] = rel;
        else if (o.diplomacy[a.id] === 'ally' || o.diplomacy[a.id] === 'pact') delete o.diplomacy[a.id];
        a.chat.push({ sys: true, text: tk('Diplomacy with [{0}]: {1}.', o.tag, { ally: tk('allies'), pact: tk('non-aggression pact'), war: tk('war') }[rel] || tk('neutral')), t: Date.now() });
      });
    },
    // A private message to another ruler (the last 60 in each conversation are kept).
    dm(toUid, text) {
      text = String(text || '').trim().slice(0, 400);
      toUid = String(toUid || '');
      if (!text) return;
      mut((w) => {
        if (!w.players[toUid] || toUid === uid) fail(tk('No such ruler.'));
        const k = dmKey(uid, toUid);
        w.dms ||= {};
        const list = (w.dms[k] ||= []);
        list.push({ uid, name: w.players[uid]?.name || tk('Ruler'), text, t: Date.now() });
        if (list.length > 60) list.splice(0, list.length - 60);
      });
    },
    dms: () => W().dms || {},
    say(text) {
      text = String(text || '').trim().slice(0, 400);
      if (!text) return;
      mut((w) => {
        const a = w.alliances[w.players[uid]?.alliance];
        if (!a) fail(tk('You are not in an alliance.'));
        a.chat.push({ uid, name: w.players[uid].name, text, t: Date.now() });
        if (a.chat.length > 200) a.chat.splice(0, a.chat.length - 200);
      });
    },
  };
}

// Alliance actions the player may request (also through the server).
const WORLD_OPS = ['createAlliance', 'invite', 'acceptInvite', 'declineInvite', 'leave', 'kick', 'setRelation', 'say', 'dm', 'sendBackStationed'];

const dmKey = (a, b) => [a, b].sort().join('|');

return { freshWorld, allocateHomeIn, buildView, makeWorld, WORLD_OPS, dmKey };
})();

__m['js/games/empires/server.js'] = (() => {
// Evil Empires – the server: every player action goes through here and is checked by
// the game logic (engine.js). It does not depend on Supabase – it receives a "database" (db):
//   getWorld() → { doc, version } | null
//   getSave(uid) → { state, version } | null
//   commit({ world: { doc, version } | null, saves: [{ uid, state | null, version }] }) → true | false (conflict)
//   listSaves() → [uid], savePush(uid, sub), deletePush(endpoint), pushSubs(uid) → [sub]
const E = __m['js/games/empires/engine.js'];
const { RACES } = __m['js/games/empires/data.js'];
const { freshWorld, allocateHomeIn, makeWorld, buildView, WORLD_OPS } = __m['js/games/empires/worldcore.js'];
const { tk } = __m['js/i18n/tk.js'];
const { render } = __m['js/i18n/render.js'];
const { BG } = __m['js/i18n/bg.js'];

const fail = (msg) => { throw new Error(msg); };
const PUSH_KINDS = ['loss', 'win', 'epoch', 'alarm'];

// One transaction: loads the world and the needed empires, runs and saves (or returns null on conflict).
async function session(db, uid, t, work) {
  const wrow = (await db.getWorld()) || { doc: freshWorld(), version: -1 };
  const doc = wrow.doc;
  const saves = new Map();
  const mine = await db.getSave(uid);
  if (mine) saves.set(uid, { ...mine, dirty: false });
  // the empires defending against my marches that have already arrived – the battles are resolved here
  if (mine) {
    for (const m of mine.state.marches || []) {
      const d = m.target?.uid;
      if (m.target?.type === 'player' && ['go', 'wait', 'battle'].includes(m.phase) && m.arrive <= t && d && !saves.has(d)) {
        const ds = await db.getSave(d);
        if (ds) saves.set(d, { ...ds, dirty: false });
      }
    }
  }
  let worldDirty = false;
  const store = { get: () => doc, mutate: (fn) => { worldDirty = true; return fn(doc); } };
  const envFor = (u, resolver) => { const w = makeWorld(store, u); w.resolveOffline = resolver; return { world: w }; };
  const resolver = (defUid, id, at) => {
    const d = saves.get(defUid);
    if (d?.state) {
      E.advance(d.state, at, envFor(defUid, null));
      d.dirty = true;
      return;
    }
    // abandoned city (the player is gone): the attacker passes without loot
    if (doc.players[defUid]) return;
    const inc = (doc.incoming[defUid] || []).find((x) => x.id === id);
    if (inc) {
      worldDirty = true;
      doc.results[id] = { win: true, loot: {}, trapped: 0, att: inc.groups.map((g) => ({ key: g.key, n: g.n, lost: 0, dmg: 0 })), def: [], defName: tk('Abandoned city'), city: '', rounds: 0 };
      doc.incoming[defUid] = doc.incoming[defUid].filter((x) => x.id !== id);
    }
  };
  const ctx = { doc, saves, store, env: envFor(uid, resolver), envFor, resolver, mine: saves.get(uid) || null, t };
  const out = await work(ctx);
  // the empire snapshots in the world (only if something changed)
  for (const [u, d] of saves) {
    if (!d.state) continue;
    const snap = E.snapshot(d.state);
    const old = doc.players[u];
    const strip = (p) => JSON.stringify({ ...p, t: 0, alliance: null, joined: 0 });
    if (!old || strip(old) !== strip(snap)) makeWorld(store, u).publish(snap);
  }
  const list = [...saves].filter(([, d]) => d.dirty).map(([u, d]) => ({ uid: u, state: d.state, version: d.version }));
  const ok = await db.commit({ world: worldDirty ? { doc, version: wrow.version } : null, saves: list });
  if (!ok) return null;
  return out ?? { state: saves.get(uid)?.state || null, view: buildView(doc, uid), now: t };
}

async function retry(fn) {
  for (let i = 0; i < 6; i++) {
    const r = await fn();
    if (r) return r;
  }
  fail(tk('The server is busy – try again.'));
}

const touch = (ctx) => { const me = ctx.saves.get(ctx.uidSelf); if (me) me.dirty = true; };

/** A request from a player. body.op: sync | new | act | world | reset | push | unpush */
async function handle(db, uid, body, now = Date.now()) {
  const op = body?.op;
  if (op === 'push') {
    if (!body.sub?.endpoint) fail(tk('Invalid subscription.'));
    await db.savePush(uid, { ...body.sub, lang: body.sub.lang === 'bg' ? 'bg' : 'en' });
    return { ok: true };
  }
  if (op === 'unpush') {
    if (body.endpoint) await db.deletePush(body.endpoint);
    return { ok: true };
  }
  return retry(() => session(db, uid, now, async (ctx) => {
    ctx.uidSelf = uid;
    const me = ctx.mine;
    const s = me?.state;
    if (op === 'sync') {
      if (s) { E.syncAbroad(s, now, ctx.env); E.advance(s, now, ctx.env); touch(ctx); }
      return;
    }
    if (op === 'new') {
      if (s) fail(tk('You already have an empire.'));
      if (!Object.prototype.hasOwnProperty.call(RACES, body.race)) fail(tk('Unknown race.'));
      const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 32) || tk('Empire');
      const home = allocateHomeIn(ctx.doc, uid);
      const ns = E.newGame(body.race, name, now, undefined, { uid, home, worldSeed: home.seed });
      ctx.saves.set(uid, { state: ns, version: -1, dirty: true });
      return;
    }
    if (!s) fail(tk('You don\'t have an empire.'));
    if (op === 'act') {
      E.syncAbroad(s, now, ctx.env);
      E.perform(s, now, ctx.env, String(body.name || ''), body.args || []);
      touch(ctx);
      return;
    }
    if (op === 'world') {
      const name = String(body.name || '');
      if (!WORLD_OPS.includes(name)) fail(tk('Unknown action.'));
      E.advance(s, now, ctx.env);
      touch(ctx);
      makeWorld(ctx.store, uid).publish(E.snapshot(s));
      const W = ctx.env.world;
      const args = Array.isArray(body.args) ? body.args.slice(0, 4) : [];
      const emb = E.maxLv(s, 'embassy');
      if (name === 'createAlliance') W.createAlliance(args[0], args[1], emb);
      else if (name === 'acceptInvite') { if (!emb) fail(tk('Embassy required.')); W.acceptInvite(String(args[0]), Math.max(3, 3 * emb)); }
      else if (name === 'invite') { if (emb < 1) fail(tk('Embassy required.')); W.invite(String(args[0])); }
      else W[name](...args.map((a) => (typeof a === 'string' ? a.slice(0, 400) : a)));
      return;
    }
    if (op === 'reset') {
      makeWorld(ctx.store, uid).removePlayer(uid);
      ctx.saves.set(uid, { ...me, state: null, dirty: true });
      return { state: null, view: null, now };
    }
    fail(tk('Unknown request.'));
  }));
}

/**
 * Every few minutes (pg_cron): moves all empires forward in time and sends
 * notifications about new events and about attacks already visible from the watchtower.
 */
async function cron(db, now = Date.now(), push = null, limit = 300) {
  const uids = (await db.listSaves()).slice(0, limit);
  let sent = 0;
  for (const uid of uids) {
    let notes = [];
    try {
      await retry(() => session(db, uid, now, async (ctx) => {
        notes = [];
        const s = ctx.mine?.state;
        if (!s) return { ok: true };
        E.syncAbroad(s, now, ctx.env);
        E.advance(s, now, ctx.env);
        ctx.saves.get(uid).dirty = true;
        // the first time we don't send old events
        const since = s.pushed ?? (s.log.length ? s.log[s.log.length - 1].id : 0);
        for (const l of s.log) if (l.id > since && PUSH_KINDS.includes(l.kind)) notes.push(l.text);
        s.pushed = s.log.length ? s.log[s.log.length - 1].id : since;
        // attacks that are already visible
        s.warned ||= [];
        const inc = [
          ...s.incoming.map((x) => ({ id: `n${x.id}`, city: x.city, name: x.name, arrive: x.arrive })),
          ...(ctx.doc.incoming[uid] || []).map((x) => ({ id: `p${x.id}`, city: x.toCity, name: x.attName, arrive: x.arrive })),
        ];
        for (const x of inc) {
          const c = E.cityOf(s, x.city);
          if (!s.warned.includes(x.id) && x.arrive - now <= E.warnWindow(s, c)) {
            s.warned.push(x.id);
            notes.push(tk('⚠ {0} attacks {1} in {2} min!', x.name, c.name, Math.max(1, Math.round((x.arrive - now) / 60000))));
          }
        }
        s.warned = s.warned.slice(-50);
        return { ok: true };
      }));
    } catch {
      continue;
    }
    if (notes.length && push) {
      const subs = await db.pushSubs(uid);
      const body = notes.length > 3 ? tk('{0}\n…and {1} more', notes.slice(-2).join('\n'), notes.length - 2) : notes.join('\n');
      for (const sub of subs) {
        // notifications in the player's language (saved with the subscription)
        try { await push(sub, { title: 'Evil Empires', body: render(body, sub.lang === 'bg' ? BG : null), url: './#/play/empires' }); sent++; } catch (e) { if (e?.gone) await db.deletePush(sub.endpoint); }
      }
    }
  }
  return { ok: true, players: uids.length, sent };
}

return { handle, cron };
})();

const { handle, cron } = __m['js/games/empires/server.js'];
// Supabase Edge Function "empires" – the Evil Empires server.
// The logic is in the bundle (generated from js/ with tools/build-empires.py) – the same one that
// runs in the browser. Every action is checked here, and the records are in the database.
//
// Requests (POST JSON, with the logged-in user's token):
//   sync | new { race, name } | act { name, args } | world { name, args } | reset | push { sub } | unpush { endpoint }
//   cron (no user, with the x-cron-secret header) – from pg_cron every few minutes.

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC') || '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE') || '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';
if (VAPID_PUBLIC && VAPID_PRIVATE) webpush.setVapidDetails('https://hackthecode.github.io/evil-games/', VAPID_PUBLIC, VAPID_PRIVATE);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// deno-lint-ignore no-explicit-any
function makeDb(sb: any) {
  const must = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r; };
  return {
    async getWorld() {
      const { data } = must(await sb.from('ee_world').select('doc, version').eq('id', 1).maybeSingle());
      return data;
    },
    async getSave(uid: string) {
      const { data } = must(await sb.from('ee_saves').select('state, version').eq('uid', uid).maybeSingle());
      return data;
    },
    // deno-lint-ignore no-explicit-any
    async commit({ world, saves }: any) {
      const { data } = must(await sb.rpc('ee_commit', { p_world: world?.doc ?? null, p_world_version: world?.version ?? 0, p_saves: saves }));
      return data === true;
    },
    async listSaves() {
      const { data } = must(await sb.from('ee_saves').select('uid').order('updated_at', { ascending: true }).limit(1000));
      // deno-lint-ignore no-explicit-any
      return (data || []).map((r: any) => r.uid);
    },
    // deno-lint-ignore no-explicit-any
    async savePush(uid: string, sub: any) {
      must(await sb.from('ee_push').upsert({ endpoint: String(sub.endpoint).slice(0, 1000), uid, sub }));
    },
    async deletePush(endpoint: string) {
      must(await sb.from('ee_push').delete().eq('endpoint', endpoint));
    },
    async pushSubs(uid: string) {
      const { data } = must(await sb.from('ee_push').select('sub').eq('uid', uid));
      // deno-lint-ignore no-explicit-any
      return (data || []).map((r: any) => r.sub);
    },
  };
}

// deno-lint-ignore no-explicit-any
async function sendPush(sub: any, payload: unknown) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 3600 });
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const code = (e as any)?.statusCode;
    if (code === 404 || code === 410) throw { gone: true };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json();
    const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
    const db = makeDb(svc);
    if (body?.op === 'cron') {
      if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'Forbidden.' }, 403);
      return json(await cron(db, Date.now(), sendPush));
    }
    const auth = req.headers.get('Authorization') || '';
    const asUser = createClient(URL_, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: 'You are not logged in.' }, 401);
    // banned account (supabase/admin.sql); if the table doesn't exist – no check
    const { data: ban } = await svc.from('bans').select('until, reason').eq('user_id', user.id).gt('until', new Date().toISOString()).maybeSingle();
    // a translation token (see js/i18n/tk.js) – the browser shows it in the player's language
    if (ban) return json({ error: `\u0001The account is banned until {0}{1}.\u001f${new Date(ban.until).toISOString().slice(0, 16).replace('T', ' ')} UTC\u001f${ban.reason ? ` (${ban.reason})` : ''}\u0002` }, 403);
    return json(await handle(db, user.id, body));
  } catch (e) {
    return json({ error: (e as Error).message || String(e) });
  }
});