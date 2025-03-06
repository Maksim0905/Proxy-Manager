document.addEventListener('DOMContentLoaded', () => {
  const enabledCheckbox = document.getElementById('enabled');
  const webrtcProtectionCheckbox = document.getElementById('webrtc-protection');
  const timezoneProtectionCheckbox = document.getElementById('timezone-protection');
  const statusElement = document.getElementById('status');
  const activeProxyInfoElement = document.getElementById('active-proxy-info');
  const activeProxyDetailsElement = document.getElementById('active-proxy-details');
  const proxyDropdownToggle = document.getElementById('proxy-dropdown-toggle');
  const proxyListContainer = document.getElementById('proxy-list-container');
  const openProxyManagerLink = document.getElementById('open-proxy-manager');
  const langEnButton = document.getElementById('lang-en');
  const langRuButton = document.getElementById('lang-ru');
  
  // Инициализируем язык
  initializeLanguage(lang => {
    updateLanguageButtons();
    updateUILanguage(lang);
  });
  
  // Загрузка состояния прокси и активного прокси
  chrome.runtime.sendMessage({ action: 'getProxyState' }, (response) => {
    if (response && response.proxyState) {
      enabledCheckbox.checked = response.proxyState.proxyEnabled;
      // Теперь WebRTC и timezone управляются разными параметрами
      webrtcProtectionCheckbox.checked = response.proxyState.webrtcProtection || false;
      timezoneProtectionCheckbox.checked = response.proxyState.timezoneProtection || false;
      
      // Сохраняем язык в localStorage и обновляем интерфейс
      const language = response.proxyState.language || 'en';
      localStorage.setItem('language', language);
      updateLanguageButtons();
      updateUILanguage(language);
      
      // Показать информацию о текущем активном прокси, если включено
      if (response.proxyState.proxyEnabled && response.proxyState.activeProxy) {
        displayActiveProxyInfo(response.proxyState.activeProxy);
      } else {
        activeProxyInfoElement.style.display = 'none';
      }
    }
  });
  
  // Загрузка списка прокси для выпадающего списка
  loadProxyList();
  
  // Обработчик для переключения состояния прокси
  enabledCheckbox.addEventListener('change', () => {
    chrome.runtime.sendMessage(
      { action: 'toggleProxy', enabled: enabledCheckbox.checked },
      (response) => {
        if (response.success) {
          displayStatus(getLocaleMessage('settings_updated'), 'success');
          
          // Отображение/скрытие информации об активном прокси
          if (enabledCheckbox.checked && response.activeProxy) {
            displayActiveProxyInfo(response.activeProxy);
          } else {
            activeProxyInfoElement.style.display = 'none';
          }
        } else {
          displayStatus(getLocaleMessage('error_prefix') + response.error, 'error');
        }
      }
    );
  });
  
  // Обработчик для переключения защиты WebRTC
  webrtcProtectionCheckbox.addEventListener('change', () => {
    chrome.runtime.sendMessage(
      { action: 'toggleWebRTC' },
      (response) => {
        if (response.success) {
          displayStatus(getLocaleMessage('settings_updated'), 'success');
        } else {
          // Возвращаем чекбокс в исходное положение
          webrtcProtectionCheckbox.checked = !webrtcProtectionCheckbox.checked;
          displayStatus(getLocaleMessage('error_prefix') + response.error, 'error');
        }
      }
    );
  });
  
  // Обработчик для переключения защиты часового пояса
  timezoneProtectionCheckbox.addEventListener('change', () => {
    chrome.runtime.sendMessage(
      { action: 'toggleTimezoneProtection' },
      (response) => {
        if (response.success) {
          if (response.alternativeMethod) {
            // Если используется альтернативный метод, показываем специальное сообщение
            displayStatus('Защита часового пояса включена (альтернативный метод)', 'success');
          } else {
            displayStatus(getLocaleMessage('settings_updated'), 'success');
          }
        } else {
          // Возвращаем чекбокс в исходное положение
          timezoneProtectionCheckbox.checked = !timezoneProtectionCheckbox.checked;
          displayStatus(getLocaleMessage('error_prefix') + response.error, 'error');
        }
      }
    );
  });
  
  // Обработчик нажатия на выпадающий список прокси
  proxyDropdownToggle.addEventListener('click', () => {
    const isVisible = proxyListContainer.style.display === 'block';
    proxyListContainer.style.display = isVisible ? 'none' : 'block';
  });
  
  // Обработчик открытия страницы управления прокси
  openProxyManagerLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  
  // Обработчики переключения языка
  langEnButton.addEventListener('click', () => {
    setLanguage('en');
  });
  
  langRuButton.addEventListener('click', () => {
    setLanguage('ru');
  });
  
  // Функция изменения языка
  function setLanguage(language) {
    // Сохраняем в localStorage
    localStorage.setItem('language', language);
    
    // Обновляем UI
    updateLanguageButtons();
    updateUILanguage(language);
    
    // Сохраняем выбранный язык в background
    chrome.runtime.sendMessage(
      { action: 'setLanguage', language: language },
      (response) => {
        if (!response.success) {
          console.error('Ошибка при сохранении языка:', response.error);
        }
      }
    );
  }
  
  // Обновление состояния кнопок языка
  function updateLanguageButtons() {
    const language = localStorage.getItem('language') || 'en';
    langEnButton.classList.toggle('active', language === 'en');
    langRuButton.classList.toggle('active', language === 'ru');
  }
  
  // Функция отображения статуса
  function displayStatus(message, type) {
    statusElement.textContent = message;
    statusElement.className = 'status ' + type;
    statusElement.style.display = 'block';
    
    // Скрыть сообщение через 3 секунды
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 3000);
  }
  
  // Функция отображения информации об активном прокси
  function displayActiveProxyInfo(proxy) {
    activeProxyInfoElement.style.display = 'block';
    
    // Формирование HTML для деталей прокси
    let detailsHTML = '';
    
    // Добавление флага страны, если есть геоинформация
    if (proxy.country && proxy.countryCode) {
      detailsHTML += `<img src="https://flagcdn.com/16x12/${proxy.countryCode.toLowerCase()}.png" class="flag" alt="${proxy.country}"> `;
      detailsHTML += `<strong>${proxy.country}</strong><br>`;
    }
    
    // Адрес и порт
    detailsHTML += `${proxy.host}:${proxy.port}`;
    
    // Добавление параметров аутентификации, если есть
    if (proxy.username) {
      detailsHTML += `<br>Пользователь: ${proxy.username}`;
    }
    
    // Статус валидности прокси
    if (proxy.isValid !== undefined) {
      const statusClass = proxy.isValid ? 'valid' : 'invalid';
      const statusText = proxy.isValid ? getLocaleMessage('valid') : getLocaleMessage('invalid');
      detailsHTML += `<br><span class="proxy-status ${statusClass}">${statusText}</span>`;
    }
    
    activeProxyDetailsElement.innerHTML = detailsHTML;
  }
  
  // Загрузка списка прокси для выпадающего списка
  function loadProxyList() {
    chrome.runtime.sendMessage({ action: 'getProxyList' }, (response) => {
      console.log('Получен ответ от getProxyList:', response);
      
      if (response && response.proxyList && response.proxyList.length > 0) {
        proxyListContainer.innerHTML = '';
        
        // Обновляем текст кнопки выпадающего списка
        const activeProxy = response.proxyList.find(p => p.id === response.activeProxyId);
        console.log('Активный прокси:', activeProxy);
        
        if (activeProxy) {
          let buttonContent = '';
          
          // Добавляем флаг страны для активного прокси в кнопке выпадающего списка
          if (activeProxy.country && activeProxy.countryCode) {
            buttonContent += `<img src="https://flagcdn.com/16x12/${activeProxy.countryCode.toLowerCase()}.png" class="flag" alt="${activeProxy.country}" title="${activeProxy.country}"> `;
          }
          
          buttonContent += `${activeProxy.host}:${activeProxy.port}`;
          proxyDropdownToggle.innerHTML = buttonContent;
        } else {
          proxyDropdownToggle.textContent = getLocaleMessage('select_proxy') || 'Выбрать прокси';
        }
        
        response.proxyList.forEach(proxy => {
          console.log('Добавление прокси в список:', proxy);
          
          const proxyItem = document.createElement('div');
          proxyItem.className = 'proxy-list-item';
          
          // Определение, является ли этот прокси активным
          const isActive = (response.activeProxyId && response.activeProxyId === proxy.id) || proxy.isActive;
          if (isActive) {
            proxyItem.classList.add('active');
          }
          
          // Отображение деталей прокси
          let itemHTML = '';
          
          // Добавление флага страны только для активного прокси в popup
          if (isActive && proxy.country && proxy.countryCode) {
            itemHTML += `<img src="https://flagcdn.com/16x12/${proxy.countryCode.toLowerCase()}.png" class="flag" alt="${proxy.country}" title="${proxy.country}">`;
          }
          
          // Адрес и порт
          itemHTML += `<span>${proxy.host}:${proxy.port}</span>`;
          
          // Время ответа для валидных прокси
          if (proxy.responseTime && proxy.isValid) {
            itemHTML += `<span style="margin-left: 5px; color: #28a745;">${proxy.responseTime} мс</span>`;
          }
          
          // Статус валидности прокси
          if (proxy.isValidating) {
            // Если прокси в процессе проверки
            itemHTML += `<span class="proxy-status validating">Проверяется...</span>`;
          } else if (proxy.isValid !== undefined) {
            const statusClass = proxy.isValid ? 'valid' : 'invalid';
            const statusText = proxy.isValid ? 'Валидный' : 'Невалидный';
            itemHTML += `<span class="proxy-status ${statusClass}">${statusText}</span>`;
          }
          
          proxyItem.innerHTML = itemHTML;
          
          // Обработчик нажатия на элемент списка прокси
          proxyItem.addEventListener('click', () => {
            console.log('Выбран прокси:', proxy.id);
            
            chrome.runtime.sendMessage(
              { action: 'setActiveProxy', proxyId: proxy.id },
              (response) => {
                console.log('Ответ на установку активного прокси:', response);
                
                if (response && response.success) {
                  // Обновление интерфейса после выбора прокси
                  proxyDropdownToggle.textContent = `${proxy.host}:${proxy.port}`;
                  proxyListContainer.style.display = 'none';
                  
                  // Обновление выбранного элемента в списке
                  const allItems = proxyListContainer.querySelectorAll('.proxy-list-item');
                  allItems.forEach(item => item.classList.remove('active'));
                  proxyItem.classList.add('active');
                  
                  // Обновление отображения активного прокси
                  displayActiveProxyInfo(proxy);
                  
                  // Включение прокси, если он был выключен
                  if (!enabledCheckbox.checked) {
                    enabledCheckbox.checked = true;
                    chrome.runtime.sendMessage({ action: 'toggleProxy', enabled: true });
                  }
                  
                  displayStatus('Настройки прокси обновлены', 'success');
                } else {
                  displayStatus('Ошибка при активации прокси', 'error');
                }
              }
            );
          });
          
          proxyListContainer.appendChild(proxyItem);
        });
      } else {
        // Если прокси нет, показать сообщение
        proxyListContainer.innerHTML = '<div class="no-proxies">У вас пока нет добавленных прокси</div>';
      }
    });
  }
});