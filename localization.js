// Глобальная переменная для хранения текущего языка
let currentLanguage = 'en';

// Локализованные строки
const localization = {
  // Общие строки
  'en': {
    // Общие элементы
    'settings': 'Proxy Settings',
    'enable_proxy': 'Enable Proxy',
    'select_proxy': 'Select Proxy',
    'active_proxy': 'Active Proxy',
    'security': 'Security Features',
    'manage_proxies': 'Manage Proxy List →',
    'settings_updated': 'Proxy settings updated',
    'error_prefix': 'Error: ',
    
    // Страница управления
    'proxy_management': 'Proxy Management',
    'proxies_tab': 'Proxies',
    'bypass_tab': 'Local Addresses',
    'supported_formats': 'Supported Formats:',
    'add_proxy': 'Add Proxy',
    'add_proxy_placeholder': 'For example: ip:port, user:password@ip:port or ip:port:user:password',
    'add_list': 'Add List',
    'add_list_placeholder': 'Enter proxy list, one per line',
    'upload_from_file': 'Upload from file',
    'supported_files': 'Supported file formats .txt, .csv, and .list with one proxy per line',
    'check_all': 'Check All Proxies',
    'delete_invalid': 'Delete Invalid Proxies',
    'delete_all': 'Delete All Proxies',
    'your_proxies': 'Your Proxies:',
    'buy_proxy': 'Buy Proxy',
    'no_proxies': 'You don\'t have any proxies yet.',
    
    // Статусы прокси
    'checking': 'Checking...',
    'valid': 'Valid',
    'invalid': 'Invalid',
    'unchecked': 'Unchecked',
    
    // Действия с прокси
    'activate': 'Activate',
    'check': 'Check',
    'delete': 'Delete',
    'activating_proxy': 'Activating proxy...',
    'proxy_activated': 'Proxy activated successfully',
    'error_activating_proxy': 'Error activating proxy',
    
    // Сообщения проверки
    'checking_proxy': 'Checking proxy...',
    'check_started': 'Check started. Results will be available in a few seconds',
    'checking_all': 'Checking all proxies. This may take some time.',
    'check_complete': 'Check complete. Valid: {0}, invalid: {1}. Country flags are loading in background.',
    'check_error': 'Error checking proxy',
    
    // Удаление прокси
    'delete_confirm': 'Are you sure you want to delete this proxy?',
    'delete_all_confirm': 'Are you sure you want to delete all proxies?',
    'proxy_deleted': 'Proxy deleted',
    'all_proxies_deleted': 'All proxies deleted',
    'error_deleting': 'Error deleting proxy',
    
    // WebRTC и защита
    'webrtc_protection': 'WebRTC Leak Protection',
    'timezone_protection': 'Hide Timezone',
    'webrtc_enabled': 'WebRTC protection enabled',
    'webrtc_disabled': 'WebRTC protection disabled',
    
    // Локальные адреса
    'bypass_title': 'Local Addresses (proxy exceptions)',
    'bypass_description': 'Traffic to the following addresses will not go through the proxy:',
    'add_bypass': 'Add Local Address',
    'bypass_placeholder': 'For example: localhost, 192.168.*.*, *.local',
    'current_exceptions': 'Current Exceptions:',
    'reset_bypass': 'Reset to Default List',
    'bypass_added': 'Local address added',
    'bypass_removed': 'Local address removed',
    'bypass_reset': 'Local address list reset to default',
    'no_bypass_items': 'No local addresses added'
  },
  'ru': {
    // Общие элементы
    'settings': 'Настройки прокси',
    'enable_proxy': 'Включить прокси',
    'select_proxy': 'Выбрать прокси',
    'active_proxy': 'Активный прокси',
    'security': 'Функции безопасности',
    'manage_proxies': 'Управление списком прокси →',
    'settings_updated': 'Настройки прокси обновлены',
    'error_prefix': 'Ошибка: ',
    
    // Страница управления
    'proxy_management': 'Управление прокси',
    'proxies_tab': 'Прокси',
    'bypass_tab': 'Локальные адреса',
    'supported_formats': 'Поддерживаемые форматы:',
    'add_proxy': 'Добавить прокси',
    'add_proxy_placeholder': 'Например: ip:port, user:password@ip:port или ip:port:user:password',
    'add_list': 'Добавить список',
    'add_list_placeholder': 'Введите список прокси, по одному на строку',
    'upload_from_file': 'Загрузить из файла',
    'supported_files': 'Поддерживаются файлы форматов .txt, .csv и .list с одним прокси на строку',
    'check_all': 'Проверить все прокси',
    'delete_invalid': 'Удалить невалидные прокси',
    'delete_all': 'Удалить все прокси',
    'your_proxies': 'Ваши прокси:',
    'buy_proxy': 'Купить прокси',
    'no_proxies': 'У вас пока нет добавленных прокси.',
    
    // Статусы прокси
    'checking': 'Проверяется...',
    'valid': 'Валидный',
    'invalid': 'Невалидный',
    'unchecked': 'Непроверенный',
    
    // Действия с прокси
    'activate': 'Активировать',
    'check': 'Проверить',
    'delete': 'Удалить',
    'activating_proxy': 'Активация прокси...',
    'proxy_activated': 'Прокси успешно активирован',
    'error_activating_proxy': 'Ошибка при активации прокси',
    
    // Сообщения проверки
    'checking_proxy': 'Проверка прокси...',
    'check_started': 'Проверка начата. Результаты будут доступны через несколько секунд',
    'checking_all': 'Проверка всех прокси. Это может занять некоторое время.',
    'check_complete': 'Проверка завершена. Валидных: {0}, невалидных: {1}. Флаги стран загружаются в фоне.',
    'check_error': 'Ошибка при проверке прокси',
    
    // Удаление прокси
    'delete_confirm': 'Вы уверены, что хотите удалить этот прокси?',
    'delete_all_confirm': 'Вы уверены, что хотите удалить все прокси?',
    'proxy_deleted': 'Прокси удален',
    'all_proxies_deleted': 'Все прокси удалены',
    'error_deleting': 'Ошибка при удалении прокси',
    
    // WebRTC и защита
    'webrtc_protection': 'Защита от WebRTC утечек',
    'timezone_protection': 'Скрывать часовой пояс',
    'webrtc_enabled': 'Защита WebRTC включена',
    'webrtc_disabled': 'Защита WebRTC отключена',
    
    // Локальные адреса
    'bypass_title': 'Локальные адреса (исключения для прокси)',
    'bypass_description': 'Трафик на следующие адреса не будет проходить через прокси:',
    'add_bypass': 'Добавить локальный адрес',
    'bypass_placeholder': 'Например: localhost, 192.168.*.*, *.local',
    'current_exceptions': 'Текущие исключения:',
    'reset_bypass': 'Вернуть список по умолчанию',
    'bypass_added': 'Локальный адрес добавлен',
    'bypass_removed': 'Локальный адрес удален',
    'bypass_reset': 'Список локальных адресов сброшен на значения по умолчанию',
    'no_bypass_items': 'Нет добавленных локальных адресов'
  }
};

// Функция для инициализации языка
function initializeLanguage(callback) {
  // Сначала пробуем получить язык из localStorage
  const storedLang = localStorage.getItem('language');
  if (storedLang) {
    currentLanguage = storedLang;
    if (callback) callback(currentLanguage);
    return;
  }
  
  // Если в localStorage нет, пробуем получить из background
  chrome.runtime.sendMessage({ action: 'getProxyState' }, function(response) {
    if (response && response.success && response.proxyState) {
      currentLanguage = response.proxyState.language || 'en';
      // Сохраняем в localStorage для будущих запросов
      localStorage.setItem('language', currentLanguage);
    } else {
      // Если не удалось получить из background, используем английский по умолчанию
      currentLanguage = 'en';
      localStorage.setItem('language', currentLanguage);
    }
    if (callback) callback(currentLanguage);
  });
}

// Функция для получения локализованной строки
function getLocaleString(key, language, ...params) {
  if (!language || !localization[language]) {
    language = 'en';
  }
  
  let text = localization[language][key] || key;
  
  // Подстановка параметров в строку
  if (params && params.length > 0) {
    for (let i = 0; i < params.length; i++) {
      text = text.replace(`{${i}}`, params[i]);
    }
  }
  
  return text;
}

// Вспомогательная функция для определения языка пользователя
async function detectUserLanguage() {
  try {
    // Пробуем определить язык по IP адресу
    const response = await fetch('https://ipinfo.io/json');
    if (response.ok) {
      const data = await response.json();
      // Если страна Россия, устанавливаем русский язык
      if (data.country === 'RU' || data.country === 'BY' || data.country === 'KZ' || data.country === 'UA') {
        return 'ru';
      }
    }
  } catch (error) {
    console.error('Ошибка при определении языка по IP:', error);
  }
  
  // По умолчанию используем английский
  return 'en';
}

// Функция для обновления UI с учетом выбранного языка
function updateUILanguage(language) {
  // Если язык не указан, берем из localStorage
  if (!language) {
    language = localStorage.getItem('language') || 'en';
  }
  
  const elements = document.querySelectorAll('[data-locale-key]');
  elements.forEach(element => {
    const key = element.getAttribute('data-locale-key');
    if (key) {
      element.textContent = getLocaleString(key, language);
    }
  });
  
  // Обновляем placeholder'ы для полей ввода
  const inputElements = document.querySelectorAll('[data-locale-placeholder]');
  inputElements.forEach(element => {
    const key = element.getAttribute('data-locale-placeholder');
    if (key) {
      element.placeholder = getLocaleString(key, language);
    }
  });
  
  console.log(`Язык интерфейса обновлен на ${language}`);
}

// Функция для получения локализованной строки по ключу
function getLocaleMessage(key, ...params) {
  // Используем глобальную переменную currentLanguage
  return getLocaleString(key, currentLanguage, ...params);
}

// Инициализация localStorage при загрузке страницы
(function initializeLocalStorage() {
  // Если язык еще не сохранен в localStorage
  if (!localStorage.getItem('language')) {
    // Пробуем получить язык из background
    chrome.runtime.sendMessage({ action: 'getProxyState' }, function(response) {
      if (response && response.success && response.proxyState) {
        const language = response.proxyState.language || 'en';
        localStorage.setItem('language', language);
        console.log(`Язык инициализирован в localStorage: ${language}`);
      } else {
        // Если не удалось получить из background, используем английский по умолчанию
        localStorage.setItem('language', 'en');
        console.log('Язык по умолчанию (en) сохранен в localStorage');
      }
    });
  }
})();

// Функция для обновления языка (для обратной совместимости)
function setCurrentLanguage(language) {
  // Обновляем глобальную переменную
  currentLanguage = language || 'en';
  // Сохраняем в localStorage
  localStorage.setItem('language', currentLanguage);
}

// Инициализируем язык при загрузке скрипта
initializeLanguage(); 