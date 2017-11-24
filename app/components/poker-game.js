import Component from '@ember/component';
import Faker from 'faker';
export default Component.extend({
  classNames: ['poker-game'],
  _ws: null,
  logs: [],
  aiTypes: [
    {
      type: 'type_straight',
      description: 'Aims for at least a straight'
    }, {
      type: 'type_flush',
      description: 'Aims for at least a flush'
    }, {
      type: 'type_high_card',
      description: 'Gives more significance to the value of a high card'
    }
  ],

  didInsertElement () {
    this._ws = new WebSocket(`ws://${location.hostname}:${8081}/game`);
    this._ws.onmessage = (msg) => {
      const body = JSON.parse(msg.data);
      console.log('Event: ', body)
      this.send(body.type, body.content)
    };
  },

  willDestroyElement () {
    this._ws.close();
  },
  actions: {
    catch_up (content) {
      this.get('logs').pushObject({
        message: 'Catching up game state'
      })
      this.set('users', content.users);
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
      this.get('logs').pushObject({
        message: `${content.joined_user} has joined room!`
      });
      this.set('joinRoomModalVisible', false);
      this.set('current_room_id', content.room_id);
      this.set('current_room_host', content.room_host);
      this.set('users', content.users);
    },

    room_ready (content = {}) {
        this.set('game_state', 'ready_admin');
        this.get('logs').pushObject({
          message: "Room is now ready to start"
        });
    },

    startGame () {
      this.get('logs').pushObject({
        message: "Attempting game start"
      })
      this._ws.send(JSON.stringify({
        type: 'start_game',
        room_id: this.get('current_room_id')
      }));
    },

    room_host_update (content) {
      this.set('current_room_host', content.current_room_host);
      this.set('current_room_id', content.current_room_id);
      this.get('logs').pushObject({
        message: `New host assigned for room ${content.current_room_id} - ${content.current_room_host}`
      })
    },
    addAItoRoom () {
      const ai = this.get('aiType');
      this._ws.send(JSON.stringify({
        type: 'room_add_ai',
        content: {
          name: `bot-${faker.name.firstName()}`,
          ai_type: ai.type,
          room_id: this.get('current_room_id')
        }
      }));
    }
  }
});
