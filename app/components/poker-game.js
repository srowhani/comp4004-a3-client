import Component from '@ember/component';
import { inject } from '@ember/service'
import { computed } from '@ember/object';
import Faker from 'faker';
export default Component.extend({
  paperToaster: inject(),
  classNames: ['poker-game'],
  _ws: null,
  logs: [],
  removeFromHandQueue: {},
  userStateMap: {},
  shouldRemove: true,
  aiTypes: [
    {
      type: 'type_one',
      description: 'Aims for at least a straight'
    }, {
      type: 'type_two',
      description: '3 visible cards leads to evaluating repull'
    }
  ],
  didInsertElement () {
    this._ws = new WebSocket(`ws://${location.hostname}:${8081}/game`);
    this._ws.onmessage = (msg) => {
      const body = JSON.parse(msg.data);
      console.log('Event: ', body)
      this.get('logs').insertAt(0, {
        message: `${body.type}: ${body.content ? JSON.stringify(body.content) : '{}'}`
      })
      try {
        this.send(body.type, body.content)
      } catch (e) {
        this.get('logs').insertAt(0, {
          message: e.message
        })
      }

    };
  },

  willDestroyElement () {
    this._ws.close();
  },

  actions: {
    catch_up (content) {
      this.get('logs').insertAt(0, {
        message: 'Catching up game state'
      })
      this.set('available_rooms', content.available_rooms);
      // update initial state
    },
    attempt_join_game () {
      const body = {
        type: 'attempt_join_game',
        content: {
          username: Faker.name.firstName()
        }
      }
      console.log(body);
      this._ws.send(JSON.stringify(body));
    },
    host_room (settings) {
      const username = Faker.name.firstName()
      this.set('username', username);
      const host_room_payload = {
        type: 'host_room',
        content: {
          capacity: settings.players,
          host: username
        }
      }
      this.set('showHostGameModal', false);
      this._ws.send(JSON.stringify(host_room_payload));
    },
    update_user_list (content) {
      this.set('users', content.users);
      content.users.forEach(u => {
        this.userStateMap[u] = this.userStateMap[u] || {}
      })
      this.set('userStateMap', Ember.copy(this.userStateMap, true))
    },
    room_created (content) {
      this.set('available_rooms', content.available_rooms);

    },
    confirm_join_room (room) {
      this.set('joinRoomModalVisible', true);
      this.set('modal_room', room);
    },
    confirm_leave_room (room) {
      this.set('leaveRoomModalVisible', true);
      this.set('modal_room', room);
    },
    attempt_join_room (room) {
      const username = Faker.name.firstName();
      this.set('username', username);
      const payload = {
        type: 'attempt_join_room',
        content: {
          room_id: room.room_id,
          username
        }
      }
      this._ws.send(JSON.stringify(payload));
    },
    join_room_success (content) {
      this.get('logs').insertAt(0, {
        message: `${content.joined_user} has joined room!`
      });
      this.set('joinRoomModalVisible', false);
      this.set('current_room_id', content.room_id);
      this.set('current_room_host', content.room_host);
      this.set('users', content.users);
      this.set('userStateMap', {})
      content.users.forEach(u => {
        this.userStateMap[u] = this.userStateMap[u] || {}
      });
      this.set('userStateMap', Ember.copy(this.userStateMap, true))
    },

    room_ready (content = {}) {
        this.set('game_state', 'ready_admin');
        this.get('logs').insertAt(0, {
          message: "Room is now ready to start"
        });
    },

    startGame () {
      this.get('logs').insertAt(0, {
        message: "Attempting game start"
      })
      this._ws.send(JSON.stringify({
        type: 'start_game',
        content: {
          room_id: this.get('current_room_id')
        }
      }));
    },

    room_host_update (content) {
      this.set('current_room_host', content.current_room_host);
      this.set('current_room_id', content.current_room_id);
      this.get('logs').insertAt(0, {
        message: `New host assigned for room ${content.current_room_id} - ${content.current_room_host}`
      })
    },
    addAItoRoom () {
      const ai_type = this.get('aiType');
      let s = {
        type: 'room_add_ai',
        content: {
          name: `bot-${faker.name.firstName()}`,
          ai_type,
          room_id: this.get('current_room_id'),
        }
      };

      if (this.get('start_cards')) {
        s.content.start_cards = this.get('start_cards');
      }

      this._ws.send(JSON.stringify(s));
    },
    game_started () {
      this.set('game_started', true);
    },
    got_cards (content) {
      this.set('hand', content.player_cards);
      Object.keys(this.userStateMap).forEach(k => {
        if (!this.userStateMap[k].cards)
          this.userStateMap[k].cards = 'XX XX XX XX XX';
      })
      this.set('userStateMap', Ember.copy(this.userStateMap, true))
      this.set('removeFromHandQueue', {});
    },
    turn_update (content) {
      this.set('isYourTurn', content.user_id === this.get('username'));
    },
    game_already_running () {
      this.set('joinRoomModalVisible', false);
      this.get('paperToaster').show('Session in progress', {
        duration: 2000
      })
    },
    action_fold () {
      this._ws.send(JSON.stringify({
        type: 'action_fold',
        content: {
          user_id: this.get('username'),
          room_id: this.get('current_room_id')
        }
      }));
    },
    action_hold () {
      this._ws.send(JSON.stringify({
        type: 'action_hold',
        content: {
          user_id: this.get('username'),
          room_id: this.get('current_room_id')
        }
      }));
    },

    toggleCardInRemoveQueue (card) {
      if (this.removeFromHandQueue[card]) {
        delete this.removeFromHandQueue[card]
        this.notifyPropertyChange('removeFromHandQueue');
      } else {
        Ember.set(this.removeFromHandQueue, card, true);
      }
      this.set('removeFromHandList', Object.keys(this.removeFromHandQueue));
      this.set('canSubmitRemoveCards', Object.keys(this.removeFromHandQueue).length)
    },
    fold (content) {
      this.userStateMap[content.user_id].state = 'state_fold'
      Ember.set(this.userStateMap[content.user_id], 'cards', content.cards.join(" "))
      this.set('userStateMap', Ember.copy(this.userStateMap, true))
    },
    improveCards (cards) {
      this._ws.send(JSON.stringify({
        type: 'improve_cards',
        content: {
          room_id: this.get('current_room_id'),
          user_id: this.get('username'),
          cards_to_improve: cards.join(" ")
        }
      }));
    },
    attempt_improve_cards (content) {
      Ember.set(this.userStateMap[content.user_id], 'cards', content.cards.join(" "))
      this.set('userStateMap', Ember.copy(this.userStateMap, true))
    },
    winner (content) {
      this.set('game_started', false);

      this.set('removeFromHandQueue', {})
      this.set('isYourTurn', false);
      content.user_list = content.user_list.sort((v, u) => u.rank - v.rank)
      this.set('winner_list', content.user_list);
      this.set('gameWinner', content.user_list[0]);
      this.get('paperToaster').show(`Winner is ${content.user_list[0].user_id}`, {
        duration: 2000
      })
    },
    askForCards (cards) {
      this._ws.send(JSON.stringify({
        type: 'ask_for_cards',
        content: {
          cards: string
        }
      }))
    },
    set_starting_cards(user_id, room_id, cards) {
      this._ws.send(JSON.stringify({
        type: 'set_starting_cards',
        content: {
          user_id,
          room_id,
          cards
        }
      }))
    },
    remove_cards_from_deck (room_id, cards) {
      this._ws.send(JSON.stringify({
        type: 'remove_cards_from_deck',
        content: {
          room_id,
          cards
        }
      }));
    },
    queue_cards_to_deck (room_id, cards) {
      this._ws.send(JSON.stringify({
        type: 'queue_cards_to_deck',
        content: {
          room_id,
          cards
        }
      }))
    },
    strat_one () {
      this.get('paperToaster').show('Using strategy one!', {
        duration: 2000
      });
    }
  }
});
