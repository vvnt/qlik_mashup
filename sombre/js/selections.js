// Barre des sélections courantes : précédent, suivant, tout effacer (icônes) et une puce par champ.
// Un clic sur une puce ouvre la liste des valeurs du champ pour en ajouter ou en retirer
// (voir value-picker.js) ; la croix retire toute la sélection du champ.

(function () {
  'use strict';

  function init(doc) {
    const bar = document.getElementById('selection-bar');
    const backBtn = document.getElementById('sel-back');
    const forwardBtn = document.getElementById('sel-forward');
    const clearBtn = document.getElementById('sel-clear');
    const chips = document.getElementById('sel-chips');
    const empty = document.getElementById('sel-empty');
    const { icon } = window.ValueList;

    // Liste déroulante ouverte : champ concerné et instance. Elle survit aux re-rendus des puces.
    const open = { field: null, picker: null };

    backBtn.addEventListener('click', () => doc.back());
    forwardBtn.addEventListener('click', () => doc.forward());
    clearBtn.addEventListener('click', () => doc.clearAll());

    function closePicker() {
      if (open.picker) open.picker.destroy();
      open.field = null;
      open.picker = null;
      chips.querySelectorAll('.chip.is-open').forEach((chip) => {
        chip.classList.remove('is-open');
        chip.querySelector('.chip__main').setAttribute('aria-expanded', 'false');
      });
    }

    // La liste déborderait de l'écran à droite : on l'aligne alors sur le bord droit de la puce.
    function keepInViewport(panel) {
      panel.style.left = '';
      panel.style.right = '';
      if (panel.getBoundingClientRect().right > document.documentElement.clientWidth - 8) {
        panel.style.left = 'auto';
        panel.style.right = '0';
      }
    }

    function attach(chip, field) {
      chip.classList.add('is-open');
      chip.querySelector('.chip__main').setAttribute('aria-expanded', 'true');
      chip.append(open.picker.el);
      keepInViewport(open.picker.el);
    }

    function toggle(chip, field) {
      const wasOpen = open.field === field;
      closePicker();
      if (wasOpen) return;
      open.field = field;
      open.picker = window.ValuePicker.create(doc, field);
      attach(chip, field);
      open.picker.focus();
    }

    function buildChip(field) {
      const item = document.createElement('li');
      item.className = 'chip';
      item.dataset.field = field.qField;

      const main = document.createElement('button');
      main.type = 'button';
      main.className = 'chip__main';
      main.setAttribute('aria-haspopup', 'true');
      main.setAttribute('aria-expanded', 'false');
      main.setAttribute('aria-label', `${field.qField} : ${field.qSelected.replace(/^(\d+) of (\d+)$/, '$1 sur $2')}. Modifier la sélection`);
      const name = document.createElement('span');
      name.className = 'chip__field';
      name.textContent = field.qField;
      const value = document.createElement('span');
      value.className = 'chip__value';
      // Qlik résume les grandes sélections en anglais (« 112 of 15008 »).
      value.textContent = field.qSelected.replace(/^(\d+) of (\d+)$/, '$1 sur $2');
      main.append(name, value, icon('chevron-down'));
      main.addEventListener('click', () => toggle(item, field.qField));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'chip__remove';
      remove.setAttribute('aria-label', 'Retirer la sélection : ' + field.qField);
      remove.append(icon('close'));
      remove.addEventListener('click', async () => {
        const model = await doc.getField(field.qField);
        model.clear();
      });

      item.append(main, remove);
      return item;
    }

    document.addEventListener('click', (event) => {
      if (open.field && !event.target.closest('.chip')) closePicker();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !open.field) return;
      const chip = chips.querySelector(`.chip[data-field="${CSS.escape(open.field)}"]`);
      closePicker();
      if (chip) chip.querySelector('.chip__main').focus();
    });

    bar.hidden = false;

    return window.Q.watch(doc, {
      qInfo: { qType: 'mashup-selections' },
      qSelectionObjectDef: {},
    }, (layout) => {
      const selection = layout.qSelectionObject || {};
      const fields = selection.qSelections || [];

      backBtn.disabled = !selection.qBackCount;
      forwardBtn.disabled = !selection.qForwardCount;
      clearBtn.disabled = fields.length === 0;
      empty.hidden = fields.length > 0;

      // Les puces sont reconstruites à chaque changement : on garde la liste ouverte,
      // sa position de défilement et le focus clavier.
      const focusedField = chips.contains(document.activeElement)
        ? document.activeElement.closest('.chip').dataset.field : null;
      const scroll = open.picker ? open.picker.el.scrollTop : 0;
      const pickerFocus = open.picker && open.picker.el.contains(document.activeElement)
        ? document.activeElement.dataset.elem : undefined;
      const searchHadFocus = !!open.picker && document.activeElement === open.picker.search;

      chips.replaceChildren(...fields.map(buildChip));

      if (open.field) {
        const chip = chips.querySelector(`.chip[data-field="${CSS.escape(open.field)}"]`);
        if (chip) {
          attach(chip, open.field);
          open.picker.el.scrollTop = scroll;
          if (searchHadFocus) open.picker.search.focus();
          if (pickerFocus !== undefined) {
            const again = open.picker.el.querySelector(`[data-elem="${pickerFocus}"]`);
            if (again) again.focus();
          }
        } else {
          closePicker();   // plus aucune valeur sélectionnée dans ce champ
        }
      }
      if (focusedField && !chips.contains(document.activeElement)) {
        const again = chips.querySelector(`.chip[data-field="${CSS.escape(focusedField)}"] .chip__main`);
        if (again) again.focus();
      }
    });
  }

  window.Selections = { init };
})();
