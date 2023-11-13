const { Telegraf, Markup, session, Scenes } = require('telegraf');
const { Sequelize, DataTypes, Op } = require('sequelize');
const moment = require('moment');

const Token = '6305154533:AAHz0bD3IoI7jiXJ8q_zyXyrQSOimDMzSis'; // Замените на ваш токен

const bot = new Telegraf(Token, { polling: true });

// Инициализация сессии
bot.use(session());

const sequelize = new Sequelize('postgres', 'pank3d', 'Max20051125_', {
  host: 'localhost',
  dialect: 'postgres',
});

// Создание модели для таблицы расходов
const Expense = sequelize.define('Expense', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
});

// Проверка подключения к базе данных и создание таблицы
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Успешное подключение к базе данных');
    await sequelize.sync();
    console.log('Таблица Expense создана (или уже существует)');
  } catch (error) {
    console.error('Ошибка подключения к базе данных:', error);
  }
})();

// Команды бота
const commands = [
  { command: 'start', description: 'Начать работу с ботом' },
  { command: 'help', description: 'Получить помощь' },
  { command: 'info', description: 'Информация о боте' },
];

// Обработчик команды /start
bot.start((ctx) => {
  ctx.reply('Выберите действие:', Markup.inlineKeyboard([
    Markup.button.callback('Внести расходы', 'add_expense'),
    Markup.button.callback('Расходы за определенный период', 'calculate_expenses')
  ]));
});

// Создание сцены для ввода суммы расхода
const addExpenseScene = new Scenes.WizardScene(
  'add_expense_scene',
  async (ctx) => {
    ctx.session.amount = '';
    ctx.reply('Введите сумму расхода (в рублях):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.session.amount = ctx.message.text;
    ctx.reply('Введите дату расхода (в формате ГГГГ-ММ-ДД):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    const userId = ctx.from.id; // Получение user_id
    const amount = ctx.session.amount;

    let momentDate = moment(ctx.message.text, 'YYYY-MM-DD', true);

    while (!momentDate.isValid()) {
      ctx.reply('Неверный формат даты. Введите дату в формате ГГГГ-ММ-ДД:');
      momentDate = moment(ctx.message.text, 'YYYY-MM-DD', true);
    }

    // Получение текущей даты
    const currentDate = moment();

    // Проверяем, что введенная дата не находится более чем 0 дней вперед от текущей даты
    const maxDate = currentDate.clone().add(0, 'days');

    if (momentDate.isAfter(maxDate, 'day')) {
      ctx.reply('Дата расхода не может быть более чем сегодняшняя дата. Введите другую дату.');
      return ctx.scene.reenter(); // Просим ввести дату снова
    }

    try {
      await Expense.create({
        userId, // Сохранение user_id
        amount: parseFloat(amount),
        date: momentDate.format('YYYY-MM-DD'), // Форматирование даты
      });

      ctx.reply(`Расход ${amount} добавлен на дату ${momentDate.format('YYYY-MM-DD')}.`);
    } catch (error) {
      console.error('Ошибка при сохранении в базу данных:', error);
      ctx.reply('Произошла ошибка при добавлении расхода.');
    }

    return ctx.scene.leave();
  }
);

// Создание сцены для расчета расходов за определенный период
const calculateExpensesScene = new Scenes.WizardScene(
  'calculate_expenses_scene',
  async (ctx) => {
    ctx.session.startDate = '';
    ctx.session.endDate = '';
    ctx.reply('Введите начальную дату периода (в формате ГГГГ-ММ-ДД):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.session.startDate = ctx.message.text;
    ctx.reply('Введите конечную дату периода (в формате ГГГГ-ММ-ДД):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    const userId = ctx.from.id; // Получение user_id
    const startDate = ctx.session.startDate;
    const endDate = ctx.message.text;

    // Проверка и форматирование дат
    const momentStartDate = moment(startDate, 'YYYY-MM-DD', true);
    const momentEndDate = moment(endDate, 'YYYY-MM-DD', true);

    if (!momentStartDate.isValid() || !momentEndDate.isValid()) {
      ctx.reply('Одна из введенных дат недействительна. Пожалуйста, введите даты в формате ГГГГ-ММ-ДД:');
      return ctx.scene.reenter(); // Просим ввести даты снова
    }

    try {
      // Получаем сумму расходов за указанный период для конкретного пользователя
      const totalExpenses = await Expense.sum('amount', {
        where: {
          userId, // Фильтрация по user_id
          date: {
            [Op.between]: [startDate, endDate],
          },
        },
      });

      ctx.reply(`Общая сумма расходов с ${startDate} по ${endDate} составляет: ${totalExpenses}`);
    } catch (error) {
      console.error('Ошибка при запросе данных из базы:', error);
      ctx.reply('Произошла ошибка при расчете расходов.');
    }

    return ctx.scene.leave();
  }
);

// Добавление сцен в бот
const stage = new Scenes.Stage([addExpenseScene, calculateExpensesScene]);
bot.use(stage.middleware());

// Обработчики для кнопок
bot.action('add_expense', (ctx) => {
  ctx.scene.enter('add_expense_scene');
});
bot.action('calculate_expenses', (ctx) => {
  ctx.scene.enter('calculate_expenses_scene');
});

// Установка команд бота
bot.telegram.setMyCommands(commands);

bot.launch();
