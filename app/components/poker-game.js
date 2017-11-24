import Component from '@ember/component';
import Faker from 'faker';
export default Component.extend({
  classNames: ['poker-game'],
  _ws: null,

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
      const payload = {
        type: 'attempt_join_room',
        content: {
          room_id: room.room_id,
          username: Faker.name.firstName()
        }
      }
      this._ws.send(JSON.stringify(payload));
    },
    join_room_success (content) {
      this.set('joinRoomModalVisible', false);
      this.set('current_room_id', content.room_id);
      this.set('users', content.users);
    }
  }
});
