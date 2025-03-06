// Списки исключений по умолчанию
const DEFAULT_BYPASS_LIST = [
  "localhost",
  "127.0.0.1",
  "<local>"
];

// Состояние прокси
let proxyState = {
  proxies: [],
  activeProxyId: null,
  proxyEnabled: false,
  bypassList: [
    'localhost',
    '127.0.0.1',
    '::1',
    '<local>'
  ],
  timezoneProtection: false,
  language: null, // Добавлено новое поле для языка
  webrtcProtection: false, // Добавлено новое поле для управления WebRTC защитой
  useAlternativeTimezoneProtection: false // Добавлено новое поле для альтернативного метода защиты часового пояса
};

// Обработчик аутентификации для прокси
let authListener = null;

// Загрузка состояния при запуске
chrome.runtime.onStartup.addListener(() => {
  initialize();
});

// Инициализация при установке расширения
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Расширение установлено или обновлено:', details.reason);
  initialize();
});

// Инициализация расширения
async function initialize() {
  console.log('Инициализация расширения Proxy Manager');
  
  // Загружаем сохраненные настройки
  await loadSettings();
  
  // Если язык не был ранее установлен, определяем автоматически
  if (!proxyState.language) {
    try {
      // Добавляем таймаут и параметры для запроса
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд таймаут
      
      // Первая попытка: ipinfo.io
      try {
        const response = await fetch('https://ipinfo.io/json', {
          signal: controller.signal,
          cache: 'no-store'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          // Если страна Россия или другие русскоговорящие, устанавливаем русский язык
          if (data.country === 'RU' || data.country === 'BY' || data.country === 'KZ' || data.country === 'UA') {
            proxyState.language = 'ru';
          } else {
            proxyState.language = 'en';
          }
          console.log(`Определен язык по IP: ${proxyState.language}, страна: ${data.country}`);
        } else {
          throw new Error(`Ошибка запроса: ${response.status}`);
        }
      } catch (ipinfoError) {
        console.warn('Ошибка при использовании ipinfo.io:', ipinfoError.message);
        
        // Вторая попытка: использовать запасной сервис ipapi.co
        try {
          const backupController = new AbortController();
          const backupTimeoutId = setTimeout(() => backupController.abort(), 5000);
          
          const backupResponse = await fetch('https://ipapi.co/json/', {
            signal: backupController.signal,
            cache: 'no-store'
          });
          
          clearTimeout(backupTimeoutId);
          
          if (backupResponse.ok) {
            const backupData = await backupResponse.json();
            // Определяем язык по коду страны
            if (backupData.country_code === 'RU' || 
                backupData.country_code === 'BY' || 
                backupData.country_code === 'KZ' || 
                backupData.country_code === 'UA') {
              proxyState.language = 'ru';
            } else {
              proxyState.language = 'en';
            }
            console.log(`Определен язык по запасному IP API: ${proxyState.language}, страна: ${backupData.country_code}`);
          } else {
            throw new Error(`Ошибка запроса к запасному сервису: ${backupResponse.status}`);
          }
        } catch (backupError) {
          console.warn('Ошибка при использовании запасного сервиса:', backupError.message);
          // По умолчанию используем язык системы или английский
          try {
            // Попытка определить язык по настройкам браузера
            const browserLanguage = navigator.language || navigator.userLanguage;
            proxyState.language = browserLanguage.startsWith('ru') ? 'ru' : 'en';
            console.log(`Определен язык по настройкам браузера: ${proxyState.language}`);
          } catch (e) {
            // Если всё не удалось, используем английский
            proxyState.language = 'en';
            console.log('Не удалось определить язык, установлен английский по умолчанию');
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при определении языка:', error);
      proxyState.language = 'en'; // По умолчанию английский
    }
    
    // Сохраняем настройки
    saveSettings();
  }
  
  console.log(`Текущий язык интерфейса: ${proxyState.language}`);
  
  // Применяем настройки WebRTC
  applyWebRTCProtection();
  
  // Применяем защиту часового пояса, если она включена
  if (proxyState.timezoneProtection) {
    // Проверяем доступность API для управления часовым поясом
    if (chrome.privacy && chrome.privacy.websites && 
        chrome.privacy.websites.timezoneOverrideEnabled &&
        chrome.privacy.websites.timezoneOverride) {
      
      applyTimezoneProtection();
      console.log('Защита часового пояса применена при инициализации через API');
    } else {
      console.log('API для защиты часового пояса недоступен, устанавливаем флаг для альтернативного метода');
      proxyState.useAlternativeTimezoneProtection = true;
      saveSettings();
      
      // Безопасная отправка сообщений всем открытым вкладкам для активации альтернативной защиты
      // Вместо непосредственной отправки, получаем список активных вкладок с URL-схемой http/https
      try {
        chrome.tabs.query({status: "complete", url: ["http://*/*", "https://*/*"]}, function(tabs) {
          if (tabs && tabs.length > 0) {
            console.log(`Найдено ${tabs.length} активных вкладок для отправки команд защиты часового пояса`);
            
            tabs.forEach(function(tab) {
              // Добавляем проверку, находится ли вкладка в загруженном состоянии
              if (tab.status === 'complete') {
                try {
                  chrome.tabs.sendMessage(
                    tab.id, 
                    { action: 'setTimezoneProtection', enabled: proxyState.timezoneProtection },
                    // Добавляем проверку результата
                    function(response) {
                      const lastError = chrome.runtime.lastError;
                      if (lastError) {
                        // Просто игнорируем ошибку, это нормально для новых вкладок
                        console.log(`Вкладка ${tab.id} еще не готова для приема сообщений`);
                      } else if (response) {
                        console.log(`Успешно применена защита часового пояса к вкладке ${tab.id}`);
                      }
                    }
                  );
                } catch (e) {
                  // Игнорируем ошибки при отправке сообщений
                  console.warn(`Невозможно отправить сообщение вкладке ${tab.id}:`, e);
                }
              }
            });
          } else {
            console.log('Активных вкладок не найдено, защита будет применена при открытии новых вкладок');
          }
        });
      } catch (e) {
        console.warn('Ошибка при поиске вкладок для применения защиты часового пояса:', e);
      }
            
      console.log('Команды для альтернативной защиты часового пояса обработаны');
    }
  }
  
  // Применяем настройки прокси, если они были включены
  if (proxyState.proxyEnabled && proxyState.activeProxyId) {
    applyProxySettings();
  }
  
  console.log('Инициализация завершена');
}

// Функция загрузки настроек
async function loadSettings() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(['proxyState'], function(result) {
        if (chrome.runtime.lastError) {
          console.error('Ошибка при загрузке настроек:', chrome.runtime.lastError);
          resolve(); // Продолжаем с настройками по умолчанию
          return;
        }
        
        if (result.proxyState) {
          console.log('Загружены сохраненные настройки:', result.proxyState);
          
          // Устанавливаем состояние из сохраненных настроек
          proxyState.proxyEnabled = result.proxyState.proxyEnabled !== undefined ? result.proxyState.proxyEnabled : false;
          proxyState.timezoneProtection = result.proxyState.timezoneProtection !== undefined ? result.proxyState.timezoneProtection : false;
          proxyState.webrtcProtection = result.proxyState.webrtcProtection !== undefined ? result.proxyState.webrtcProtection : false;
          
          // Загружаем список прокси
          if (Array.isArray(result.proxyState.proxies)) {
            proxyState.proxies = result.proxyState.proxies;
          }
          
          // Загружаем список исключений
          if (Array.isArray(result.proxyState.bypassList)) {
            proxyState.bypassList = result.proxyState.bypassList;
          } else {
            // Если список исключений отсутствует, установим по умолчанию
            proxyState.bypassList = DEFAULT_BYPASS_LIST;
          }
          
          // Устанавливаем активный прокси
          if (result.proxyState.activeProxyId) {
            proxyState.activeProxyId = result.proxyState.activeProxyId;
            const activeProxy = proxyState.proxies.find(p => p.id === proxyState.activeProxyId);
            if (activeProxy) {
              proxyState.activeProxy = activeProxy;
            } else if (proxyState.proxies.length > 0) {
              // Если активный прокси не найден, но есть другие прокси, установим первый как активный
              proxyState.activeProxy = proxyState.proxies[0];
              proxyState.activeProxyId = proxyState.proxies[0].id;
            }
          } else if (proxyState.proxies.length > 0) {
            // Если активный прокси не был установлен, но есть прокси, устанавливаем первый
            proxyState.activeProxy = proxyState.proxies[0];
            proxyState.activeProxyId = proxyState.proxies[0].id;
          }
        } else {
          console.log('Сохраненные настройки не найдены, используем настройки по умолчанию');
          // Устанавливаем список исключений по умолчанию
          proxyState.bypassList = DEFAULT_BYPASS_LIST;
        }
        
        resolve();
      });
    } catch (error) {
      console.error('Ошибка при загрузке настроек:', error);
      reject(error);
    }
  });
}

// Функция сохранения настроек
function saveSettings() {
  try {
    const settingsToSave = JSON.parse(JSON.stringify(proxyState));
    chrome.storage.local.set({ 'proxyState': settingsToSave }, function() {
      console.log('Настройки сохранены успешно');
    });
  } catch (error) {
    console.error('Ошибка при сохранении настроек:', error);
  }
}

// Функция для применения защиты WebRTC
function applyWebRTCProtection() {
  // Проверяем доступность API для управления WebRTC
  if (chrome.privacy && chrome.privacy.network && 
      chrome.privacy.network.webRTCIPHandlingPolicy) {
    
    // Устанавливаем политику обработки IP для WebRTC
    const policy = proxyState.webrtcProtection 
      ? 'disable_non_proxied_udp' // Запрещаем WebRTC соединения в обход прокси
      : 'default'; // Стандартное поведение
    
    chrome.privacy.network.webRTCIPHandlingPolicy.set({
      value: policy
    });
    
    // Также для дополнительной защиты можно отключить нелокальные UDP
    if (chrome.privacy.network.webRTCNonProxiedUdpEnabled) {
      chrome.privacy.network.webRTCNonProxiedUdpEnabled.set({
        value: !proxyState.webrtcProtection,
        scope: 'regular'
      });
    }
    
    console.log(`WebRTC защита ${proxyState.webrtcProtection ? 'включена' : 'отключена'}`);
  } else {
    console.warn('API для управления WebRTC недоступен');
  }
}

// Применение защиты часового пояса
function applyTimezoneProtection() {
  // Проверяем доступность API для управления часовым поясом
  if (chrome.privacy && chrome.privacy.websites && 
      chrome.privacy.websites.timezoneOverrideEnabled &&
      chrome.privacy.websites.timezoneOverride) {
    
    if (proxyState.timezoneProtection) {
      // Применяем настройки для скрытия часового пояса
      chrome.privacy.websites.timezoneOverrideEnabled.set({
        value: true,
        scope: 'regular'
      });
      
      // Устанавливаем часовой пояс UTC чтобы избежать утечки
      chrome.privacy.websites.timezoneOverride.set({
        value: 'UTC',
        scope: 'regular'
      });
      
      console.log('Защита часового пояса включена через API');
    } else {
      // Отключаем переопределение часового пояса
      chrome.privacy.websites.timezoneOverrideEnabled.set({
        value: false,
        scope: 'regular'
      });
      
      console.log('Защита часового пояса отключена через API');
    }
  } else {
    console.warn('API для управления часовым поясом недоступен, используем альтернативный метод');
    
    // Устанавливаем флаг для использования альтернативного метода
    proxyState.useAlternativeTimezoneProtection = true;
    saveSettings();
  }
}

// Применяем настройки прокси
function applyProxySettings() {
  if (proxyState.proxyEnabled && proxyState.activeProxy) {
    // Настройка прокси
    const config = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: "http",
          host: proxyState.activeProxy.host,
          port: parseInt(proxyState.activeProxy.port)
        },
        bypassList: proxyState.bypassList
      }
    };
    
    chrome.proxy.settings.set(
      { value: config, scope: 'regular' },
      function() {
        console.log('Прокси настройки применены:', proxyState.activeProxy.host + ':' + proxyState.activeProxy.port);
        
        // Настройка аутентификации, если есть данные
        if (proxyState.activeProxy.username && proxyState.activeProxy.password) {
          setupProxyAuth(proxyState.activeProxy.host, parseInt(proxyState.activeProxy.port), proxyState.activeProxy.username, proxyState.activeProxy.password);
        }
      }
    );
  } else {
    // Отключение прокси
    chrome.proxy.settings.set(
      { value: { mode: "direct" }, scope: 'regular' },
      function() {
        console.log('Прокси отключен');
      }
    );
  }
}

// Настройка аутентификации прокси
function setupProxyAuth(host, port, username, password) {
  // Сначала удаляем предыдущий слушатель, если он был
  if (authListener) {
    try {
      chrome.webRequest.onAuthRequired.removeListener(authListener);
      console.log('Предыдущий обработчик аутентификации удален');
    } catch (error) {
      console.error('Ошибка при удалении предыдущего обработчика аутентификации:', error);
    }
  }
  
  // Определяем новый слушатель аутентификации
  authListener = function(details, callback) {
    console.log('Запрос аутентификации для URL:', details.url);
    
    if (!proxyState.proxyEnabled || !proxyState.activeProxy) {
      console.log('Прокси отключен или не выбран, отменяем аутентификацию');
      return { cancel: true };
    }
    
    if (!username || !password) {
      console.log('Отсутствуют данные для аутентификации');
      return { cancel: true };
    }
    
    console.log(`Отправляем данные аутентификации для прокси ${proxyState.activeProxy.host}:${proxyState.activeProxy.port}`);
    
    return {
      authCredentials: {
        username: username,
        password: password
      }
    };
  };
  
  // Добавляем слушатель
  try {
    chrome.webRequest.onAuthRequired.addListener(
      authListener,
      { urls: ["<all_urls>"] },
      ['blocking']
    );
    console.log(`Аутентификация настроена для прокси с пользователем: ${username}`);
  } catch (error) {
    console.error('Ошибка при настройке аутентификации:', error);
  }
}

// Добавление нового прокси
function addProxy(proxy) {
  try {
    // Проверка на существование прокси с таким же хостом и портом
    const existingProxyIndex = proxyState.proxies.findIndex(
      p => p.host === proxy.host && p.port === proxy.port
    );
    
    if (existingProxyIndex !== -1) {
      return { success: false, error: 'Прокси с таким адресом уже существует' };
    }
    
    // Генерация уникального ID для прокси
    const newProxy = {
      ...proxy,
      id: Date.now().toString(),
      // Устанавливаем isValid в переданное значение или null, если не указан
      isValid: proxy.isValid !== undefined ? proxy.isValid : null
    };
    
    // Добавление прокси в список
    proxyState.proxies.push(newProxy);
    
    // Если это первый прокси или активный прокси не установлен, устанавливаем его как активный
    if (!proxyState.activeProxy || proxyState.proxies.length === 1) {
      proxyState.activeProxy = newProxy;
      proxyState.activeProxyId = newProxy.id;
    }
    
    // Сохранение настроек
    saveSettings();
    
    console.log(`Прокси ${newProxy.host}:${newProxy.port} добавлен, isValid=${newProxy.isValid}`);
    
    // Автоматическая проверка нового прокси только если это одиночное добавление, а не из списка
    if (newProxy.isValid === null) {
      // Автоматическую проверку запускаем с увеличенной задержкой
      // при добавлении одного прокси, для списка будет отдельная проверка
      setTimeout(async () => {
        try {
          const validityResult = await checkProxyValidity(newProxy.id);
          console.log(`Результат автоматической проверки прокси ${newProxy.host}:${newProxy.port}:`, validityResult);
        } catch (error) {
          console.error(`Ошибка при автоматической проверке прокси ${newProxy.host}:${newProxy.port}:`, error);
        }
      }, 2000); // Увеличенная задержка в 2 секунды
    }
    
    return { success: true, proxy: newProxy };
  } catch (error) {
    console.error('Ошибка при добавлении прокси:', error);
    return { success: false, error: error.message };
  }
}

// Удаление прокси
function removeProxy(proxyId) {
  const index = proxyState.proxies.findIndex(p => p.id === proxyId);
  
  if (index === -1) {
    return { success: false, error: 'Прокси не найден' };
  }
  
  // Удаление прокси из списка
  proxyState.proxies.splice(index, 1);
  
  // Если был удален активный прокси
  if (proxyState.activeProxyId === proxyId) {
    // Если есть другие прокси, делаем первый активным
    if (proxyState.proxies.length > 0) {
      proxyState.activeProxy = proxyState.proxies[0];
      proxyState.activeProxyId = proxyState.proxies[0].id;
    } else {
      // Иначе сбрасываем активный прокси
      proxyState.activeProxy = null;
      proxyState.activeProxyId = null;
      
      // Если прокси был включен, отключаем
      if (proxyState.proxyEnabled) {
        proxyState.proxyEnabled = false;
        applyProxySettings();
      }
    }
  }
  
  // Сохранение настроек
  saveSettings();
  
  return { success: true };
}

// Удаление всех невалидных прокси
function removeInvalidProxies() {
  try {
    console.log('Удаление невалидных прокси');
    
    // Сохраняем количество прокси перед удалением
    const initialCount = proxyState.proxies.length;
    
    // Проверяем, есть ли прокси в статусе проверки
    const validatingProxies = proxyState.proxies.filter(proxy => proxy.isValidating);
    if (validatingProxies.length > 0) {
      console.log(`Найдено ${validatingProxies.length} прокси в процессе проверки. Дождитесь завершения проверки.`);
      return { 
        success: false, 
        error: `Найдено ${validatingProxies.length} прокси в процессе проверки. Дождитесь завершения проверки.` 
      };
    }
    
    // Создаем новый массив без невалидных прокси
    const validProxies = proxyState.proxies.filter(proxy => proxy.isValid !== false);
    
    // Количество удаленных прокси
    const removedCount = initialCount - validProxies.length;
    
    // Если ничего не удалено, просто возвращаем результат
    if (removedCount === 0) {
      return { success: true, removedCount: 0, message: 'Невалидные прокси не найдены' };
    }
    
    // Обновляем список прокси
    proxyState.proxies = validProxies;
    
    // Если удален активный прокси, выбираем новый активный прокси
    if (proxyState.activeProxyId) {
      const activeProxyExists = proxyState.proxies.some(p => p.id === proxyState.activeProxyId);
      if (!activeProxyExists) {
        // Если есть хотя бы один валидный прокси, выбираем его как активный
        if (proxyState.proxies.length > 0) {
          // Выбираем первый валидный прокси
          const firstValidProxy = proxyState.proxies.find(p => p.isValid === true);
          if (firstValidProxy) {
            proxyState.activeProxy = firstValidProxy;
            proxyState.activeProxyId = firstValidProxy.id;
          } else {
            // Если нет валидных, берем первый из списка
            proxyState.activeProxy = proxyState.proxies[0];
            proxyState.activeProxyId = proxyState.proxies[0].id;
          }
        } else {
          // Если список пуст, сбрасываем активный прокси
          proxyState.activeProxy = null;
          proxyState.activeProxyId = null;
          // И отключаем прокси
          proxyState.proxyEnabled = false;
        }
        
        // Применяем настройки
        applyProxySettings();
      }
    }
    
    // Сохраняем настройки
    saveSettings();
    
    console.log(`Удалено ${removedCount} невалидных прокси`);
    
    return { 
      success: true, 
      removedCount: removedCount,
      message: `Удалено ${removedCount} невалидных прокси` 
    };
  } catch (error) {
    console.error('Ошибка при удалении невалидных прокси:', error);
    return { success: false, error: error.message };
  }
}

// Установка активного прокси
function setActiveProxy(proxyId) {
  console.log(`Установка активного прокси с ID: ${proxyId}`);
  
  // Находим прокси по ID
  const proxy = proxyState.proxies.find(p => p.id === proxyId);
  
  if (!proxy) {
    console.error(`Прокси с ID ${proxyId} не найден`);
    return { success: false, error: 'Прокси не найден' };
  }
  
  console.log(`Найден прокси: ${proxy.host}:${proxy.port}`);
  
  // Устанавливаем новый активный прокси
  proxyState.activeProxy = proxy;
  proxyState.activeProxyId = proxyId;
  
  console.log(`Установлен активный прокси: ${proxy.host}:${proxy.port}`);
  
  // Если прокси включен, применяем настройки
  if (proxyState.proxyEnabled) {
    applyProxySettings();
  }
  
  // Сохраняем настройки
  saveSettings();
  
  return { 
    success: true, 
    message: `Прокси ${proxy.host}:${proxy.port} активирован`,
    activeProxy: proxy,
  };
}

// Управление списком исключений
function addBypassAddress(address) {
  if (!address || typeof address !== 'string' || address.trim() === '') {
    return { success: false, error: 'Адрес не может быть пустым' };
  }
  
  const trimmedAddress = address.trim();
  
  if (proxyState.bypassList.includes(trimmedAddress)) {
    return { success: false, error: 'Этот адрес уже в списке исключений' };
  }
  
  try {
    proxyState.bypassList.push(trimmedAddress);
    saveSettings();
    
    // Если прокси включен, применяем новые настройки
    if (proxyState.proxyEnabled && proxyState.activeProxy) {
      applyProxySettings();
    }
    
    return { success: true, address: trimmedAddress };
  } catch (error) {
    console.error('Ошибка при добавлении адреса в список исключений:', error);
    return { success: false, error: error.message };
  }
}

function removeBypassAddress(address) {
  // Не позволяем удалять стандартные исключения
  if (DEFAULT_BYPASS_LIST.includes(address)) {
    return { success: false, error: 'Невозможно удалить стандартное исключение' };
  }
  
  const index = proxyState.bypassList.indexOf(address);
  if (index !== -1) {
    proxyState.bypassList.splice(index, 1);
    saveSettings();
    
    // Если прокси включен, применяем новые настройки
    if (proxyState.proxyEnabled && proxyState.activeProxy) {
      applyProxySettings();
    }
    
    return { success: true };
  }
  
  return { success: false, error: 'Адрес не найден в списке исключений' };
}

function resetBypassList() {
  try {
    proxyState.bypassList = [...DEFAULT_BYPASS_LIST];
    saveSettings();
    
    // Если прокси включен, применяем новые настройки
    if (proxyState.proxyEnabled && proxyState.activeProxy) {
      applyProxySettings();
    }
    
    return { success: true };
  } catch (error) {
    console.error('Ошибка при сбросе списка исключений:', error);
    return { success: false, error: error.message };
  }
}

// Функция для проверки валидности прокси по его ID
async function checkProxyValidity(proxyId, skipGeoInfo = true) {
  try {
    console.log(`Начинаем проверку прокси с ID: ${proxyId}`);
    
    // Найдем прокси в списке
    const proxy = proxyState.proxies.find(p => p.id === proxyId);
    if (!proxy) {
      console.error(`Прокси с ID ${proxyId} не найден`);
      return { success: false, error: 'Прокси не найден' };
    }
    
    console.log(`Проверка прокси: ${proxy.host}:${proxy.port}`);
    
    // Сохраняем текущие настройки
    const currentEnabled = proxyState.proxyEnabled;
    const currentActiveProxy = proxyState.activeProxy ? { ...proxyState.activeProxy } : null;
    
    // Создаем копию прокси для проверки
    const proxyForCheck = { ...proxy };
    
    // Помечаем прокси как проверяемый
    const proxyIndex = proxyState.proxies.findIndex(p => p.id === proxyId);
    if (proxyIndex !== -1) {
      proxyState.proxies[proxyIndex].isValidating = true;
      // Удаляем старые данные о валидности, чтобы показать, что прокси проверяется заново
      delete proxyState.proxies[proxyIndex].isValid;
      // Сохраняем изменения для обновления интерфейса
      saveSettings();
    }

    // Применяем временные настройки для проверки
    try {
      await new Promise(resolve => {
        chrome.proxy.settings.set({
          value: {
            mode: "fixed_servers",
            rules: {
              singleProxy: {
                scheme: "http",
                host: proxy.host,
                port: parseInt(proxy.port)
              },
              bypassList: proxyState.bypassList
            }
          },
          scope: 'regular'
        }, resolve);
      });
    } catch (settingsError) {
      console.error('Ошибка при применении временных настроек прокси:', settingsError);
      
      // В случае ошибки обновляем прокси как невалидный
      if (proxyIndex !== -1) {
        proxyState.proxies[proxyIndex].isValid = false;
        delete proxyState.proxies[proxyIndex].isValidating;
        saveSettings();
      }
      
      return { success: false, error: settingsError.message };
    }
    
    // Установка аутентификации, если указаны логин и пароль
    if (proxy.username && proxy.password) {
      await setupProxyAuth(proxy.host, parseInt(proxy.port), proxy.username, proxy.password);
    }
    
    // Небольшая пауза для уверенности, что настройки применились
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Проверяем прокси, пытаясь сделать запрос к нескольким тестовым URL
    // Используем AbortController для таймаута
    const controller = new AbortController();
    const signal = controller.signal;
    const timeout = setTimeout(() => controller.abort(), 8000); // Таймаут 8 секунд
    
    const testUrls = [
      'https://www.google.com',
      'https://www.example.com',
      'https://www.cloudflare.com'
    ];
    
    let isValid = false;
    let responseTime = 0;
    
    try {
      // Пробуем по очереди, если хоть один ответил - считаем прокси валидным
      for (const url of testUrls) {
        try {
          console.log(`Проверка прокси ${proxy.host}:${proxy.port} через URL: ${url}`);
          
          // Измеряем время ответа
          const startTime = Date.now();
          
          const response = await fetch(url, {
            method: 'HEAD',
            signal: signal,
            cache: 'no-store' // Отключаем кэширование
          });
          
          const endTime = Date.now();
          responseTime = endTime - startTime;
          
          if (response.ok) {
            isValid = true;
            console.log(`Прокси ${proxy.host}:${proxy.port} валиден! Ответ от ${url}: ${response.status}`);
            break; // Если нашли один валидный URL, дальше не проверяем
          }
        } catch (urlError) {
          console.log(`Ошибка при проверке ${url} через прокси ${proxy.host}:${proxy.port}:`, urlError);
          // Продолжаем проверять следующие URL
        }
      }
      
      // Очищаем таймаут
      clearTimeout(timeout);
      
      // Если все проверки прошли неудачно, статус - невалидный
      if (!isValid) {
        console.log(`Прокси ${proxy.host}:${proxy.port} невалиден, время ответа: ${responseTime}мс`);
      }
      
      // Получаем информацию о стране, если прокси валидный и не нужно пропускать гео-информацию
      if (isValid && !skipGeoInfo) {
        try {
          // Пытаемся определить страну через сервис ipapi.co
          console.log(`Получаем информацию о стране для прокси ${proxy.host}:${proxy.port}`);
          
          const geoController = new AbortController();
          const geoTimeout = setTimeout(() => geoController.abort(), 5000); // Таймаут 5 секунд
          
          try {
            const geoResponse = await fetch('https://ipapi.co/json/', {
              signal: geoController.signal
            });
            
            if (geoResponse.ok) {
              const geoData = await geoResponse.json();
              if (geoData.country_name && geoData.country_code) {
                proxy.country = geoData.country_name;
                proxy.countryCode = geoData.country_code.toLowerCase();
                console.log(`Страна прокси ${proxy.host}:${proxy.port}: ${proxy.country} (${proxy.countryCode})`);
              }
            }
          } catch (primaryGeoError) {
            console.log('Ошибка при определении страны через основной сервис:', primaryGeoError);
            
            // Пробуем запасной сервис
            try {
              const fallbackGeoResponse = await fetch('https://ipinfo.io/json', {
                signal: geoController.signal
              });
              
              if (fallbackGeoResponse.ok) {
                const fallbackGeoData = await fallbackGeoResponse.json();
                if (fallbackGeoData.country) {
                  proxy.countryCode = fallbackGeoData.country.toLowerCase();
                  // Преобразуем код страны в название
                  const countryMap = {
                    'ru': 'Russia',
                    'us': 'United States',
                    'ua': 'Ukraine',
                    'de': 'Germany',
                    'gb': 'United Kingdom',
                    'fr': 'France'
                    // Можно добавить другие страны по необходимости
                  };
                  proxy.country = countryMap[proxy.countryCode] || proxy.countryCode.toUpperCase();
                  console.log(`Страна прокси (запасной сервис) ${proxy.host}:${proxy.port}: ${proxy.country} (${proxy.countryCode})`);
                }
              }
            } catch (secondaryGeoError) {
              console.log('Ошибка при определении страны через запасной сервис:', secondaryGeoError);
            }
          } finally {
            clearTimeout(geoTimeout);
          }
        } catch (geoError) {
          console.log('Не удалось получить геоданные прокси:', geoError);
        }
      }
      
      // Обновляем состояние прокси в списке
      // Получаем свежий индекс, на случай если список изменился
      const updatedProxyIndex = proxyState.proxies.findIndex(p => p.id === proxyId);
      if (updatedProxyIndex !== -1) {
        const updatedProxy = { ...proxyState.proxies[updatedProxyIndex] };
        updatedProxy.isValid = isValid;
        updatedProxy.responseTime = responseTime;
        delete updatedProxy.isValidating;
        
        // Сохраняем информацию о стране, если она была получена
        if (proxy.country) updatedProxy.country = proxy.country;
        if (proxy.countryCode) updatedProxy.countryCode = proxy.countryCode;
        
        proxyState.proxies[updatedProxyIndex] = updatedProxy;
        saveSettings();
      }
      
      console.log(`Проверка прокси ${proxy.host}:${proxy.port} завершена. Результат: ${isValid ? 'валидный' : 'невалидный'}, время ответа: ${responseTime}мс`);
      
      return { success: true, isValid, responseTime };
    } catch (fetchError) {
      console.error('Ошибка при проверке прокси через fetch:', fetchError);
      
      // В случае ошибки обновляем прокси как невалидный
      const updatedProxyIndex = proxyState.proxies.findIndex(p => p.id === proxyId);
      if (updatedProxyIndex !== -1) {
        const updatedProxy = { ...proxyState.proxies[updatedProxyIndex] };
        updatedProxy.isValid = false;
        delete updatedProxy.isValidating;
        proxyState.proxies[updatedProxyIndex] = updatedProxy;
        saveSettings();
      }
      
      return { success: false, error: fetchError.message };
    }
  } catch (error) {
    console.error(`Ошибка при проверке прокси ${proxy ? `${proxy.host}:${proxy.port}` : proxyId}:`, error);
    
    // В случае ошибки снимаем флаг проверки
    const updatedProxyIndex = proxyState.proxies.findIndex(p => p.id === proxyId);
    if (updatedProxyIndex !== -1) {
      const updatedProxy = { ...proxyState.proxies[updatedProxyIndex] };
      delete updatedProxy.isValidating;
      proxyState.proxies[updatedProxyIndex] = updatedProxy;
      saveSettings();
    }
    
    return { success: false, error: error.message };
  }
}

// Функция для проверки всех прокси асинхронно и параллельно
async function checkAllProxies() {
  try {
    console.log('Начинаем проверку всех прокси');
    console.log(`Всего прокси для проверки: ${proxyState.proxies.length}`);
    
    if (proxyState.proxies.length === 0) {
      console.log('Список прокси пуст, проверка не требуется');
      return { success: true, message: 'Список прокси пуст', valid: 0, invalid: 0 };
    }
    
    // Создаем копию для итерации, чтобы избежать проблем с изменением массива во время перебора
    const proxiesToCheck = [...proxyState.proxies];
    
    // Для параллельной проверки будем использовать батчи по 5 прокси одновременно
    // Это предотвратит перегрузку сетевого соединения
    const BATCH_SIZE = 5;
    
    let validCount = 0;
    let invalidCount = 0;
    let totalCount = proxiesToCheck.length;
    
    // Для каждого прокси устанавливаем статус "в процессе проверки"
    proxiesToCheck.forEach(proxy => {
      const proxyIndex = proxyState.proxies.findIndex(p => p.id === proxy.id);
      if (proxyIndex !== -1) {
        proxyState.proxies[proxyIndex].isValidating = true;
        // Удаляем предыдущую информацию о стране, чтобы получить новую
        delete proxyState.proxies[proxyIndex].country;
        delete proxyState.proxies[proxyIndex].countryCode;
      }
    });
    
    // Сохраняем изменения для обновления интерфейса
    saveSettings();
    
    // Функция для обработки одного батча прокси
    async function processBatch(batch) {
      // Запускаем проверку всех прокси в батче параллельно
      const checkPromises = batch.map(async (proxy) => {
        try {
          console.log(`Запуск проверки прокси: ${proxy.host}:${proxy.port}`);
          
          // Проверяем прокси с получением информации о стране
          const result = await checkProxyValidity(proxy.id, false);
          
          if (result && result.success && result.isValid) {
            validCount++;
            console.log(`Прокси ${proxy.host}:${proxy.port} валиден, время ответа: ${result.responseTime}мс`);
          } else {
            invalidCount++;
            console.log(`Прокси ${proxy.host}:${proxy.port} невалиден или произошла ошибка`);
            // Явно устанавливаем статус прокси как невалидный в случае ошибки
            const proxyIndex = proxyState.proxies.findIndex(p => p.id === proxy.id);
            if (proxyIndex !== -1) {
              proxyState.proxies[proxyIndex].isValid = false;
              delete proxyState.proxies[proxyIndex].isValidating;
              saveSettings();
            }
          }
          
          // Сохраняем после каждой проверки для обновления UI
          saveSettings();
          
          return { proxyId: proxy.id, result };
        } catch (error) {
          console.error(`Ошибка при проверке прокси ${proxy.host}:${proxy.port}:`, error);
          
          // Обрабатываем ошибку и устанавливаем статус "невалидный"
          const errorProxyIndex = proxyState.proxies.findIndex(p => p.id === proxy.id);
          if (errorProxyIndex !== -1) {
            proxyState.proxies[errorProxyIndex].isValid = false;
            delete proxyState.proxies[errorProxyIndex].isValidating;
          }
          
          invalidCount++;
          
          // Сохраняем изменения
          saveSettings();
          
          return { proxyId: proxy.id, error };
        }
      });
      
      // Ждем завершения всех проверок в батче
      return Promise.all(checkPromises);
    }
    
    // Разбиваем все прокси на батчи
    const batches = [];
    for (let i = 0; i < proxiesToCheck.length; i += BATCH_SIZE) {
      batches.push(proxiesToCheck.slice(i, i + BATCH_SIZE));
    }
    
    // Последовательно обрабатываем батчи
    for (let i = 0; i < batches.length; i++) {
      console.log(`Обработка батча ${i+1}/${batches.length} (${batches[i].length} прокси)`);
      await processBatch(batches[i]);
      
      // Небольшая пауза между батчами для стабильности
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Проверка всех прокси завершена. Валидных: ${validCount}, невалидных: ${invalidCount}`);
    
    // Проверяем, остались ли прокси со статусом "в процессе проверки"
    // (на случай, если что-то пошло не так)
    proxyState.proxies.forEach(proxy => {
      if (proxy.isValidating) {
        console.log(`Очищаем статус "в процессе проверки" для прокси ${proxy.host}:${proxy.port}`);
        delete proxy.isValidating;
      }
    });
    
    // Сохраняем изменения
    saveSettings();
    
    return { 
      success: true, 
      message: `Проверка завершена. Валидных: ${validCount}, невалидных: ${invalidCount}`, 
      valid: validCount, 
      invalid: invalidCount 
    };
  } catch (error) {
    console.error('Ошибка при проверке всех прокси:', error);
    
    // Очищаем статусы "в процессе проверки" при ошибке
    proxyState.proxies.forEach(proxy => {
      if (proxy.isValidating) {
        delete proxy.isValidating;
      }
    });
    
    // Сохраняем изменения
    saveSettings();
    
    return { success: false, error: error.message };
  }
}

// Удаление всех прокси
function removeAllProxies() {
  try {
    console.log('Удаление всех прокси');
    console.log(`Всего прокси до удаления: ${proxyState.proxies.length}`);
    
    // Проверяем, есть ли прокси в статусе проверки
    const validatingProxies = proxyState.proxies.filter(proxy => proxy.isValidating);
    if (validatingProxies.length > 0) {
      console.log(`Найдено ${validatingProxies.length} прокси в процессе проверки. Дождитесь завершения проверки.`);
      return { 
        success: false, 
        error: `Найдено ${validatingProxies.length} прокси в процессе проверки. Дождитесь завершения проверки.` 
      };
    }
    
    // Сохраняем количество прокси перед удалением
    const count = proxyState.proxies.length;
    
    // Очищаем список прокси
    proxyState.proxies = [];
    
    // Сбрасываем активный прокси
    proxyState.activeProxy = null;
    proxyState.activeProxyId = null;
    
    // Отключаем прокси
    proxyState.proxyEnabled = false;
    
    // Применяем настройки (отключаем прокси)
    applyProxySettings();
    
    // Сохраняем настройки
    saveSettings();
    
    console.log(`Удалены все прокси (${count} шт.)`);
    
    return { success: true, count };
  } catch (error) {
    console.error('Ошибка при удалении всех прокси:', error);
    return { success: false, error: error.message };
  }
}

// Обработчик сообщений от расширения
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Получено сообщение:', message.action);
  
  try {
    switch (message.action) {
      case 'toggleProxy':
        proxyState.proxyEnabled = !proxyState.proxyEnabled;
        applyProxySettings();
        saveSettings();
        sendResponse({ success: true, enabled: proxyState.proxyEnabled });
        break;
        
      case 'getProxyState':
        sendResponse({ 
          success: true, 
          proxyState: {
            proxyEnabled: proxyState.proxyEnabled,
            timezoneProtection: proxyState.timezoneProtection,
            webrtcProtection: proxyState.webrtcProtection,
            useAlternativeTimezoneProtection: proxyState.useAlternativeTimezoneProtection || false,
            activeProxy: proxyState.activeProxy,
            activeProxyId: proxyState.activeProxyId,
            proxyCount: proxyState.proxies.length,
            language: proxyState.language || 'en'
          } 
        });
        break;
        
      case 'getProxyList':
        // Упрощенный ответ с простой структурой данных
        sendResponse({ 
          success: true, 
          proxyList: proxyState.proxies,
          activeProxyId: proxyState.activeProxyId
        });
        break;
        
      case 'addProxy':
        const addResult = addProxy(message.proxy);
        sendResponse(addResult);
        break;
        
      case 'addProxyList':
        try {
          const results = {
            success: true,
            added: 0,
            failed: 0,
            errors: []
          };
          
          if (message.proxies && Array.isArray(message.proxies)) {
            const addedProxies = [];
            
            // Сначала добавляем все прокси в список
            for (const proxyData of message.proxies) {
              try {
                // При добавлении списком устанавливаем isValid=null, чтобы показать, что статус неизвестен
                const result = addProxy({...proxyData, isValid: null});
                if (result.success) {
                  results.added++;
                  addedProxies.push(result.proxy);
                } else {
                  results.failed++;
                  results.errors.push(result.error);
                }
              } catch (error) {
                results.failed++;
                results.errors.push(error.message);
                console.error('Ошибка при добавлении прокси:', error);
              }
            }
            
            // Сохраняем настройки после добавления всех прокси
            saveSettings();
            console.log(`Добавление списка прокси завершено. Добавлено: ${results.added}, не удалось: ${results.failed}`);
            
            // Запускаем проверку недавно добавленных прокси асинхронно
            if (addedProxies.length > 0) {
              console.log(`Запускаем проверку ${addedProxies.length} недавно добавленных прокси...`);
              
              // Проверяем только новые добавленные прокси, а не все
              setTimeout(async () => {
                try {
                  // Создаем вспомогательную функцию для проверки только новых прокси
                  async function checkNewProxies(proxyList) {
                    let validCount = 0;
                    let invalidCount = 0;

                    for (const proxy of proxyList) {
                      try {
                        console.log(`Проверка нового прокси: ${proxy.host}:${proxy.port}`);
                        const result = await checkProxyValidity(proxy.id, false);  // Получаем гео-информацию
                        if (result && result.success && result.isValid) {
                          validCount++;
                        } else {
                          invalidCount++;
                        }
                      } catch (error) {
                        console.error(`Ошибка при проверке прокси ${proxy.host}:${proxy.port}:`, error);
                        invalidCount++;
                      }
                    }

                    return { 
                      success: true, 
                      message: `Проверка новых прокси завершена. Валидных: ${validCount}, невалидных: ${invalidCount}`, 
                      valid: validCount, 
                      invalid: invalidCount 
                    };
                  }

                  // Запускаем проверку только для новых прокси
                  const checkResult = await checkNewProxies(addedProxies);
                  console.log('Проверка добавленных прокси завершена:', checkResult);
                } catch (error) {
                  console.error('Ошибка при проверке добавленных прокси:', error);
                }
              }, 2000); // Задержка 2 секунды
            }
          } else {
            results.success = false;
            results.error = 'Некорректный формат списка прокси';
          }
          
          sendResponse(results);
        } catch (error) {
          console.error('Ошибка при обработке списка прокси:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;
        
      case 'removeProxy':
        const removeResult = removeProxy(message.proxyId);
        sendResponse(removeResult);
        break;
        
      case 'setActiveProxy':
        const setResult = setActiveProxy(message.proxyId);
        sendResponse(setResult);
        break;
        
      case 'getBypassList':
        sendResponse({ success: true, bypassList: proxyState.bypassList });
        break;
        
      case 'addBypassAddress':
        const bypassResult = addBypassAddress(message.address);
        sendResponse(bypassResult);
        break;
        
      case 'removeBypassAddress':
        const removeBypassResult = removeBypassAddress(message.address);
        sendResponse(removeBypassResult);
        break;
        
      case 'resetBypassList':
        const resetResult = resetBypassList();
        sendResponse(resetResult);
        break;
        
      case 'checkProxyValidity':
        // Для асинхронных операций возвращаем true и используем sendResponse позже
        checkProxyValidity(message.proxyId, message.skipGeoInfo !== undefined ? message.skipGeoInfo : false)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Указываем, что ответ будет отправлен асинхронно
        
      case 'checkAllProxies':
        // Для асинхронных операций возвращаем true и используем sendResponse позже
        console.log('Получена команда checkAllProxies, запускаем проверку...');
        checkAllProxies()
          .then(result => {
            console.log('Проверка всех прокси завершена, результат:', result);
            sendResponse(result);
          })
          .catch(error => {
            console.error('Ошибка при проверке всех прокси:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Указываем, что ответ будет отправлен асинхронно
        
      case 'removeInvalidProxies':
        const invalidResult = removeInvalidProxies();
        sendResponse(invalidResult);
        break;
        
      case 'removeAllProxies':
        const allResult = removeAllProxies();
        sendResponse(allResult);
        break;
        
      case 'toggleTimezoneProtection':
        // Меняем состояние защиты часового пояса
        proxyState.timezoneProtection = !proxyState.timezoneProtection;
        
        // Проверяем доступность API
        if (chrome.privacy && chrome.privacy.websites && 
            chrome.privacy.websites.timezoneOverrideEnabled &&
            chrome.privacy.websites.timezoneOverride) {
          
          applyTimezoneProtection();
          saveSettings();
          sendResponse({ success: true, enabled: proxyState.timezoneProtection });
        } else {
          console.warn('API для управления часовым поясом недоступен, используем альтернативный метод');
          
          // Устанавливаем флаг для использования альтернативного метода
          proxyState.useAlternativeTimezoneProtection = true;
          saveSettings();
          
          // Безопасная отправка сообщений всем открытым вкладкам для активации альтернативной защиты
          // Вместо непосредственной отправки, получаем список активных вкладок с URL-схемой http/https
          try {
            chrome.tabs.query({status: "complete", url: ["http://*/*", "https://*/*"]}, function(tabs) {
              if (tabs && tabs.length > 0) {
                console.log(`Найдено ${tabs.length} активных вкладок для отправки команд защиты часового пояса`);
                
                tabs.forEach(function(tab) {
                  // Добавляем проверку, находится ли вкладка в загруженном состоянии
                  if (tab.status === 'complete') {
                    try {
                      chrome.tabs.sendMessage(
                        tab.id, 
                        { action: 'setTimezoneProtection', enabled: proxyState.timezoneProtection },
                        // Добавляем проверку результата
                        function(response) {
                          const lastError = chrome.runtime.lastError;
                          if (lastError) {
                            // Просто игнорируем ошибку, это нормально для новых вкладок
                            console.log(`Вкладка ${tab.id} еще не готова для приема сообщений`);
                          } else if (response) {
                            console.log(`Успешно применена защита часового пояса к вкладке ${tab.id}`);
                          }
                        }
                      );
                    } catch (e) {
                      // Игнорируем ошибки при отправке сообщений
                      console.warn(`Невозможно отправить сообщение вкладке ${tab.id}:`, e);
                    }
                  }
                });
              } else {
                console.log('Активных вкладок не найдено, защита будет применена при открытии новых вкладок');
              }
            });
          } catch (e) {
            console.warn('Ошибка при поиске вкладок для применения защиты часового пояса:', e);
          }
          
          sendResponse({ 
            success: true, 
            enabled: proxyState.timezoneProtection,
            alternativeMethod: true
          });
        }
        break;
        
      case 'setLanguage':
        // Устанавливаем новый язык
        if (message.language && (message.language === 'en' || message.language === 'ru')) {
          proxyState.language = message.language;
          saveSettings();
          console.log(`Язык интерфейса изменен на ${message.language}`);
          sendResponse({ success: true });
        } else {
          console.error('Неверный параметр языка:', message.language);
          sendResponse({ success: false, error: 'Неверное значение языка' });
        }
        break;
        
      case 'toggleWebRTC':
        // Проверяем доступность API
        if (chrome.privacy && chrome.privacy.network && 
            chrome.privacy.network.webRTCIPHandlingPolicy) {
          
          proxyState.webrtcProtection = !proxyState.webrtcProtection;
          applyWebRTCProtection();
          saveSettings();
          sendResponse({ success: true, enabled: proxyState.webrtcProtection });
        } else {
          console.warn('API для управления WebRTC недоступен');
          sendResponse({ 
            success: false, 
            error: 'API для управления WebRTC недоступен в вашем браузере' 
          });
        }
        break;
        
      default:
        console.error('Неизвестный action:', message.action);
        sendResponse({ success: false, error: 'Неизвестная команда' });
    }
  } catch (error) {
    console.error('Ошибка при обработке сообщения:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Для асинхронных ответов
});