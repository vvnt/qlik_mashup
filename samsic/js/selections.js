// Barre des sélections courantes : précédent, suivant, tout effacer (icônes) et une puce par champ.
// Un clic sur une puce ouvre la liste des valeurs du champ pour en ajouter ou en retirer
// (voir value-picker.js) ; la croix retire toute la sélection du champ.
// Bande des filtres collée et compactée (js/sticky-controls.js) : les puces défilent
// horizontalement, la liste est alors placée par rapport à l'écran pour ne pas être rognée.

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

    const band = document.getElementById('controls-band');
    const compact = () => !!band && band.classList.contains('is-stuck');
    const wide = window.matchMedia('(min-width: 48em)');

    // La liste déborderait de l'écran à droite : on l'aligne alors sur le bord droit de la puce.
    // Bande compactée : position fixe sous la puce, bornée à l'écran.
    function keepInViewport(panel, chip) {
      panel.style.position = '';
      panel.style.top = '';
      panel.style.left = '';
      panel.style.right = '';
      const viewport = document.documentElement.clientWidth;
      if (compact()) {
        const rect = chip.getBoundingClientRect();
        panel.style.position = 'fixed';
        panel.style.top = `${Math.round(rect.bottom + 4)}px`;
        // Mobile : toute la largeur, 8 px de marge de chaque côté.
        if (!wide.matches) {
          panel.style.left = '8px';
          panel.style.right = '8px';
          return;
        }
        panel.style.right = 'auto';
        const left = Math.min(rect.left, viewport - 8 - panel.offsetWidth);
        panel.style.left = `${Math.max(8, Math.round(left))}px`;
        return;
      }
      if (panel.getBoundingClientRect().right > viewport - 8) {
        panel.style.left = 'auto';
        panel.style.right = '0';
      }
    }

    function attach(chip, field) {
      chip.classList.add('is-open');
      chip.querySelector('.chip__main').setAttribute('aria-expanded', 'true');
      chip.append(open.picker.el);
      keepInViewport(open.picker.el, chip);
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
      const fieldName = window.Vocab.fieldLabel(field.qField);
      const summary = window.Vocab.selectionText(field);
      main.setAttribute('aria-label', `${fieldName} : ${summary}. Modifier la sélection`);
      const name = document.createElement('span');
      name.className = 'chip__field';
      name.textContent = fieldName;
      const value = document.createElement('span');
      value.className = 'chip__value';
      value.textContent = summary;
      main.append(name, value, icon('chevron-down'));
      main.addEventListener('click', () => toggle(item, field.qField));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'chip__remove';
      remove.setAttribute('aria-label', 'Retirer la sélection : ' + fieldName);
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
    // La bande change de forme, ou les puces défilent sous une liste fixe : on referme.
    document.addEventListener('controls-stuck', () => { if (open.field) closePicker(); });
    chips.addEventListener('scroll', () => { if (open.field && compact()) closePicker(); }, { passive: true });
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
